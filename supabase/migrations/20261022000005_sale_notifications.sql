-- Zoviah — tell a creator when someone buys with her coupon.
--
-- Flow: a trigger on shopify_orders queues one notification per order when
-- the order is attributed to a creator AND paid. The webhook / sync code then
-- claims the queue (ingest-key gated, like the order RPCs) and sends e-mails
-- through Resend.
--
-- Guards:
--   * per org on/off (organization_settings.sale_notifications_enabled);
--     only orders processed after it was switched on are queued, so a
--     historical sync or a re-attribution never mails old sales;
--   * per creator opt-out (creators.notify_sales);
--   * test / cancelled orders and personal-coupon orders (never attributed)
--     are not queued; one row per order (unique), so duplicate webhooks
--     can't send twice.
-- No customer data is stored or sent.

alter table public.organization_settings
  add column sale_notifications_enabled boolean not null default false,
  add column sale_notifications_since   timestamptz;

alter table public.creators
  add column notify_sales boolean not null default true;

create table public.sale_notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  creator_id      uuid not null references public.creators (id) on delete cascade,
  order_id        uuid not null unique references public.shopify_orders (id) on delete cascade,
  channel         text not null default 'email' check (channel in ('email')),
  status          text not null default 'pending'
                  check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts        integer not null default 0,
  last_error      text check (last_error is null or char_length(last_error) <= 300),
  claimed_at      timestamptz,
  sent_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index sale_notifications_queue_idx
  on public.sale_notifications (organization_id, status, created_at)
  where status in ('pending', 'failed', 'sending');

alter table public.sale_notifications enable row level security;
create policy sale_notifications_select_member
  on public.sale_notifications for select to authenticated
  using (public.is_organization_member(organization_id));

-- ===========================================================================
-- Queue trigger
-- ===========================================================================
create or replace function public.queue_sale_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_since timestamptz;
begin
  if new.creator_id is null or new.test or new.cancelled_at is not null
     or upper(coalesce(new.financial_status, '')) not in ('PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED') then
    return new;
  end if;

  select s.sale_notifications_since into v_since
  from public.organization_settings s
  where s.organization_id = new.organization_id and s.sale_notifications_enabled;
  if v_since is null or new.processed_at < v_since then
    return new;
  end if;

  if not exists (
    select 1 from public.creators c
    where c.id = new.creator_id and c.notify_sales and c.archived_at is null
      and nullif(btrim(c.email), '') is not null
  ) then
    return new;
  end if;

  insert into public.sale_notifications (organization_id, creator_id, order_id)
  values (new.organization_id, new.creator_id, new.id)
  on conflict (order_id) do nothing;
  return new;
end;
$$;

create trigger shopify_orders_queue_sale_notification
  after insert or update of creator_id, financial_status, cancelled_at
  on public.shopify_orders
  for each row execute function public.queue_sale_notification();

-- ===========================================================================
-- Claim / finish (ingest-key gated: called from the webhook, no session)
-- ===========================================================================
-- Returns everything the e-mail needs. Rows stuck in 'sending' for 10 min and
-- failed rows with < 3 attempts are retried.
create or replace function public.claim_sale_notifications(
  p_org uuid, p_ingest_key text, p_limit integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_out jsonb;
begin
  perform public.assert_shopify_ingest_key(p_org, p_ingest_key);

  with picked as (
    select n.id from public.sale_notifications n
    where n.organization_id = p_org
      and (n.status = 'pending'
           or (n.status = 'failed' and n.attempts < 3)
           or (n.status = 'sending' and n.claimed_at < now() - interval '10 minutes'))
    order by n.created_at
    limit least(greatest(coalesce(p_limit, 20), 1), 50)
    for update skip locked
  ), claimed as (
    update public.sale_notifications n
       set status = 'sending', claimed_at = now(), attempts = n.attempts + 1
      from picked
     where n.id = picked.id
    returning n.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', cl.id,
    'creator_email', c.email,
    'creator_name', coalesce(nullif(btrim(c.preferred_name), ''), split_part(c.full_name, ' ', 1)),
    'organization_name', org.name,
    'code', ca.code,
    'order_name', o.name,
    'subtotal', o.subtotal,
    'currency', o.currency,
    'processed_at', o.processed_at,
    'commission', cm.amount,
    'month_orders', (
      select count(*) from public.shopify_orders o2
      where o2.organization_id = p_org and o2.creator_id = cl.creator_id
        and not o2.test and o2.cancelled_at is null
        and date_trunc('month', o2.processed_at at time zone 'America/Sao_Paulo')
          = date_trunc('month', o.processed_at at time zone 'America/Sao_Paulo')
    ),
    'month_commission', (
      select coalesce(sum(cm2.amount), 0) from public.commissions cm2
      join public.shopify_orders o3 on o3.id = cm2.order_id
      where cm2.organization_id = p_org and cm2.creator_id = cl.creator_id
        and cm2.status <> 'reversed'
        and date_trunc('month', o3.processed_at at time zone 'America/Sao_Paulo')
          = date_trunc('month', o.processed_at at time zone 'America/Sao_Paulo')
    )
  ) order by cl.created_at), '[]'::jsonb)
  into v_out
  from claimed cl
  join public.creators c on c.id = cl.creator_id
  join public.organizations org on org.id = cl.organization_id
  join public.shopify_orders o on o.id = cl.order_id
  left join public.creator_affiliations ca
    on ca.organization_id = cl.organization_id and ca.creator_id = cl.creator_id
  left join public.commissions cm on cm.order_id = cl.order_id and cm.status <> 'reversed';

  return v_out;
end;
$$;
revoke all on function public.claim_sale_notifications(uuid, text, integer) from public;
grant execute on function public.claim_sale_notifications(uuid, text, integer) to anon, authenticated;

create or replace function public.finish_sale_notification(
  p_org uuid, p_ingest_key text, p_id uuid, p_status text, p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_shopify_ingest_key(p_org, p_ingest_key);
  if p_status not in ('sent', 'failed', 'skipped') then raise exception 'INVALID_PAYLOAD'; end if;
  update public.sale_notifications set
    status     = p_status,
    sent_at    = case when p_status = 'sent' then now() else sent_at end,
    last_error = case when p_status = 'sent' then null else left(p_error, 300) end
  where id = p_id and organization_id = p_org and status = 'sending';
end;
$$;
revoke all on function public.finish_sale_notification(uuid, text, uuid, text, text) from public;
grant execute on function public.finish_sale_notification(uuid, text, uuid, text, text) to anon, authenticated;

-- ===========================================================================
-- Settings (owner/admin)
-- ===========================================================================
create or replace function public.set_sale_notifications(p_org uuid, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_admin(p_org) then raise exception 'FORBIDDEN'; end if;
  insert into public.organization_settings (organization_id, sale_notifications_enabled, sale_notifications_since)
  values (p_org, coalesce(p_enabled, false), case when p_enabled then now() end)
  on conflict (organization_id) do update set
    sale_notifications_enabled = excluded.sale_notifications_enabled,
    -- (Re)starting the notices never mails sales made while they were off.
    sale_notifications_since = case
      when excluded.sale_notifications_enabled
           and not public.organization_settings.sale_notifications_enabled then now()
      else public.organization_settings.sale_notifications_since
    end;
  return jsonb_build_object('ok', true, 'enabled', coalesce(p_enabled, false));
end;
$$;
revoke all on function public.set_sale_notifications(uuid, boolean) from public;
grant execute on function public.set_sale_notifications(uuid, boolean) to authenticated;

create or replace function public.set_creator_notify_sales(p_creator_id uuid, p_enabled boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_org uuid;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select organization_id into v_org from public.creators where id = p_creator_id;
  if v_org is null then raise exception 'CREATOR_NOT_FOUND'; end if;
  if not public.is_organization_admin(v_org) then raise exception 'FORBIDDEN'; end if;
  update public.creators set notify_sales = coalesce(p_enabled, true), updated_at = now()
  where id = p_creator_id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.set_creator_notify_sales(uuid, boolean) from public;
grant execute on function public.set_creator_notify_sales(uuid, boolean) to authenticated;
