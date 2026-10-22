-- Zoviah — creator tiers ("categorias": e.g. FORTE 5%, PODEROSA 7%, RARA 10%).
--
-- Each organization defines its tiers; a creator belongs to at most one.
-- The tier carries the default commission rate. Effective rate for an order:
--   creator_affiliations.commission_rate (individual override, when set)
--   else the creator's tier rate
--   else no commission.
-- Rates are still snapshotted on the commission row when it is first created
-- (refresh_shopify_commission); a later rate change applies to orders that
-- have no commission yet. Paid commissions are never touched.

-- ===========================================================================
-- creator_tiers + creators.tier_id
-- ===========================================================================
create table public.creator_tiers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 60),
  commission_rate  numeric(5, 2) not null check (commission_rate between 0 and 100),
  description      text check (description is null or char_length(description) <= 500),
  position         integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index creator_tiers_org_name_key
  on public.creator_tiers (organization_id, lower(btrim(name)));

create trigger creator_tiers_set_updated_at
  before update on public.creator_tiers
  for each row execute function public.set_updated_at();

alter table public.creator_tiers enable row level security;
create policy creator_tiers_select_member
  on public.creator_tiers for select to authenticated
  using (public.is_organization_member(organization_id));
-- Writes only through the RPCs below (they also recompute commissions).

alter table public.creators
  add column tier_id uuid references public.creator_tiers (id) on delete set null;
create index creators_tier_idx on public.creators (tier_id) where tier_id is not null;

-- ===========================================================================
-- Effective commission rate
-- ===========================================================================
create or replace function public.creator_commission_rate(p_org uuid, p_creator_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select ca.commission_rate from public.creator_affiliations ca
      where ca.organization_id = p_org and ca.creator_id = p_creator_id),
    (select t.commission_rate from public.creators c
       join public.creator_tiers t on t.id = c.tier_id
      where c.id = p_creator_id and c.organization_id = p_org)
  );
$$;
revoke all on function public.creator_commission_rate(uuid, uuid) from public, anon, authenticated;

-- Same body as 20261020000001, only the rate lookup changes.
create or replace function public.refresh_shopify_commission(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o       public.shopify_orders%rowtype;
  c       public.commissions%rowtype;
  v_rate  numeric;
  v_hold  integer;
  v_status text;
begin
  select * into o from public.shopify_orders where id = p_order_id;
  if not found then return; end if;
  select * into c from public.commissions where order_id = p_order_id;

  if c.id is not null and c.status = 'paid' then
    return;
  end if;

  if o.creator_id is null or o.test then
    delete from public.commissions where order_id = p_order_id;
    return;
  end if;

  -- The rate is snapshotted when the commission is first created for this
  -- creator; a later rate change applies to new orders only.
  if c.id is not null and c.creator_id = o.creator_id then
    v_rate := c.rate;
  else
    v_rate := public.creator_commission_rate(o.organization_id, o.creator_id);
  end if;
  if v_rate is null then
    delete from public.commissions where order_id = p_order_id;
    return;
  end if;

  v_status := case
    when o.cancelled_at is not null
      or upper(coalesce(o.financial_status, '')) in ('REFUNDED', 'VOIDED')
      or o.subtotal <= 0 then 'reversed'
    when upper(coalesce(o.financial_status, '')) in ('PAID', 'PARTIALLY_REFUNDED', 'PARTIALLY_PAID') then 'pending'
    else 'awaiting_payment'
  end;

  select s.commission_hold_days into v_hold
  from public.organization_settings s
  where s.organization_id = o.organization_id;

  insert into public.commissions (
    organization_id, creator_id, order_id, base_amount, rate, amount,
    currency, status, approvable_at
  ) values (
    o.organization_id, o.creator_id, o.id, greatest(o.subtotal, 0), v_rate,
    round(greatest(o.subtotal, 0) * v_rate / 100, 2),
    o.currency, v_status, o.processed_at + make_interval(days => coalesce(v_hold, 30))
  )
  on conflict (order_id) do update set
    creator_id    = excluded.creator_id,
    base_amount   = excluded.base_amount,
    rate          = excluded.rate,
    amount        = excluded.amount,
    currency      = excluded.currency,
    status        = excluded.status,
    approvable_at = excluded.approvable_at;
end;
$$;

-- Fill in commissions a rate change made computable (orders of these
-- creators that have no commission yet, or an unpaid one). Snapshotted rates
-- on existing rows stay as they are.
create or replace function public.refresh_creator_commissions(p_org uuid, p_creator_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare o record;
begin
  for o in
    select so.id from public.shopify_orders so
    left join public.commissions c on c.order_id = so.id
    where so.organization_id = p_org
      and so.creator_id = any (p_creator_ids)
      and (c.id is null or c.status <> 'paid')
  loop
    perform public.refresh_shopify_commission(o.id);
  end loop;
end;
$$;
revoke all on function public.refresh_creator_commissions(uuid, uuid[]) from public, anon, authenticated;

-- ===========================================================================
-- RPCs (owner/admin)
-- ===========================================================================
create or replace function public.save_creator_tier(
  p_org             uuid,
  p_id              uuid,
  p_name            text,
  p_commission_rate numeric,
  p_description     text,
  p_position        integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id   uuid;
  v_name text := btrim(coalesce(p_name, ''));
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_admin(p_org) then raise exception 'FORBIDDEN'; end if;
  if char_length(v_name) not between 1 and 60 then raise exception 'INVALID_NAME'; end if;
  if p_commission_rate is null or p_commission_rate < 0 or p_commission_rate > 100 then
    raise exception 'INVALID_RATE';
  end if;
  if exists (
    select 1 from public.creator_tiers
    where organization_id = p_org and lower(btrim(name)) = lower(v_name)
      and id is distinct from p_id
  ) then
    raise exception 'TIER_NAME_TAKEN';
  end if;

  if p_id is null then
    insert into public.creator_tiers (organization_id, name, commission_rate, description, position)
    values (
      p_org, v_name, p_commission_rate, nullif(btrim(coalesce(p_description, '')), ''),
      coalesce(p_position, (select coalesce(max(position), -1) + 1 from public.creator_tiers where organization_id = p_org))
    )
    returning id into v_id;
  else
    update public.creator_tiers set
      name            = v_name,
      commission_rate = p_commission_rate,
      description     = nullif(btrim(coalesce(p_description, '')), ''),
      position        = coalesce(p_position, position)
    where id = p_id and organization_id = p_org
    returning id into v_id;
    if v_id is null then raise exception 'TIER_NOT_FOUND'; end if;

    perform public.refresh_creator_commissions(
      p_org, array(select id from public.creators where tier_id = v_id));
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
revoke all on function public.save_creator_tier(uuid, uuid, text, numeric, text, integer) from public;
grant execute on function public.save_creator_tier(uuid, uuid, text, numeric, text, integer) to authenticated;

create or replace function public.delete_creator_tier(p_org uuid, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_members uuid[];
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_admin(p_org) then raise exception 'FORBIDDEN'; end if;
  v_members := array(select id from public.creators where tier_id = p_id and organization_id = p_org);
  delete from public.creator_tiers where id = p_id and organization_id = p_org;
  if not found then raise exception 'TIER_NOT_FOUND'; end if;
  -- tier_id is set null by the FK; their uncommissioned orders stay so.
  perform public.refresh_creator_commissions(p_org, v_members);
  return jsonb_build_object('ok', true, 'members', coalesce(array_length(v_members, 1), 0));
end;
$$;
revoke all on function public.delete_creator_tier(uuid, uuid) from public;
grant execute on function public.delete_creator_tier(uuid, uuid) to authenticated;

create or replace function public.set_creator_tier(p_creator_id uuid, p_tier_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_org   uuid;
  v_old   uuid;
  v_name  text;
  v_actor text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select organization_id, tier_id into v_org, v_old from public.creators where id = p_creator_id;
  if v_org is null then raise exception 'CREATOR_NOT_FOUND'; end if;
  if not public.is_organization_admin(v_org) then raise exception 'FORBIDDEN'; end if;
  if p_tier_id is not null then
    select name into v_name from public.creator_tiers
    where id = p_tier_id and organization_id = v_org;
    if v_name is null then raise exception 'TIER_NOT_FOUND'; end if;
  end if;

  if v_old is not distinct from p_tier_id then
    return jsonb_build_object('ok', true, 'changed', false);
  end if;

  update public.creators set tier_id = p_tier_id, updated_at = now() where id = p_creator_id;
  perform public.refresh_creator_commissions(v_org, array[p_creator_id]);

  select email into v_actor from auth.users where id = v_uid;
  insert into public.creator_events
    (organization_id, creator_id, type, actor_user_id, data)
  values (
    v_org, p_creator_id, 'tier_changed', v_uid,
    jsonb_build_object('tier', v_name, 'actor_email', v_actor)
  );

  return jsonb_build_object('ok', true, 'changed', true);
end;
$$;
revoke all on function public.set_creator_tier(uuid, uuid) from public;
grant execute on function public.set_creator_tier(uuid, uuid) to authenticated;
