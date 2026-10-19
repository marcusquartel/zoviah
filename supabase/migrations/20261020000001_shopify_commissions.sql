-- Zoviah — Shopify sales attribution + creator commissions.
--
-- A tenant connects its own Shopify store with an app it created in the
-- Shopify Dev Dashboard (client credentials grant). Orders arrive by webhook
-- and by on-demand sync; each order is attributed to a creator by coupon code
-- first, then by UTM (last visit, then first visit), and a commission row is
-- kept in step with the order.
--
-- Security model — the app never holds the service_role key:
--   * Store credentials (client secret, short-lived access token) are
--     encrypted by the Next.js server (AES-256-GCM, key only in the server
--     env) before they reach the database. The DB only ever sees ciphertext.
--   * Webhooks have no user session. Their writes go through SECURITY DEFINER
--     functions that require an "ingest key" — HMAC(server key, org id) — whose
--     SHA-256 is stored at connect time. Only a holder of the server key can
--     produce it, so anon callers cannot inject orders.
--   * Ciphertext lookups by shop domain are anon-callable on purpose (the
--     webhook route must find its connection); ciphertext is useless without
--     the server key.
--   * Everything an admin does (connect, disconnect, set rates, mark paid)
--     re-derives authorization from auth.uid() via is_organization_admin().

-- ===========================================================================
-- 1. Tables
-- ===========================================================================
alter table public.organization_settings
  add column if not exists commission_hold_days integer not null default 30
    check (commission_hold_days between 0 and 365);

create table public.shopify_connections (
  organization_id   uuid primary key references public.organizations (id) on delete cascade,
  shop_domain       text not null unique
                      check (shop_domain ~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$'),
  client_id         text not null check (char_length(client_id) between 8 and 200),
  secret_enc        text,            -- AES-GCM ciphertext of the client secret
  token_enc         text,            -- AES-GCM ciphertext of the access token
  token_expires_at  timestamptz,
  ingest_key_hash   text check (ingest_key_hash is null or ingest_key_hash ~ '^[0-9a-f]{64}$'),
  scopes            text,
  status            text not null default 'connected'
                      check (status in ('connected', 'error', 'disconnected')),
  webhooks_ok       boolean not null default false,
  last_sync_at      timestamptz,
  last_error        text check (last_error is null or char_length(last_error) <= 500),
  connected_by      uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger shopify_connections_set_updated_at
  before update on public.shopify_connections
  for each row execute function public.set_updated_at();

-- Secrets table: RLS on, no policy, no grants — only definer functions reach it.
alter table public.shopify_connections enable row level security;
revoke all on table public.shopify_connections from public, anon, authenticated;

-- One affiliate code per creator per tenant: it is both the Shopify coupon
-- and the value matched against utm_campaign / utm_content.
create table public.creator_affiliations (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  creator_id          uuid not null references public.creators (id) on delete cascade,
  code                text not null check (code ~ '^[A-Z0-9_-]{3,40}$'),
  commission_rate     numeric(5, 2) not null check (commission_rate between 0 and 100),
  discount_percent    numeric(5, 2) check (discount_percent is null or discount_percent between 0 and 100),
  shopify_discount_id text check (shopify_discount_id is null or char_length(shopify_discount_id) <= 200),
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, creator_id),
  unique (organization_id, code)
);

create trigger creator_affiliations_set_updated_at
  before update on public.creator_affiliations
  for each row execute function public.set_updated_at();

alter table public.creator_affiliations enable row level security;
create policy creator_affiliations_select_member
  on public.creator_affiliations for select to authenticated
  using (public.is_organization_member(organization_id));

-- Orders: only what attribution and commissions need. No customer data.
create table public.shopify_orders (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  shopify_order_id  text not null check (char_length(shopify_order_id) <= 100),
  name              text check (name is null or char_length(name) <= 60),
  processed_at      timestamptz not null,
  cancelled_at      timestamptz,
  financial_status  text check (financial_status is null or char_length(financial_status) <= 40),
  currency          text not null default 'BRL' check (char_length(currency) <= 8),
  subtotal          numeric(14, 2) not null default 0,  -- current subtotal after discounts, excl. shipping/taxes
  total_discounts   numeric(14, 2) not null default 0,
  total_refunded    numeric(14, 2) not null default 0,
  discount_codes    text[] not null default '{}',
  utm_last          jsonb,
  utm_first         jsonb,
  creator_id        uuid references public.creators (id) on delete set null,
  attribution       text check (attribution is null or attribution in ('coupon', 'utm_last', 'utm_first')),
  test              boolean not null default false,
  synced_at         timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  unique (organization_id, shopify_order_id)
);

create index shopify_orders_org_processed_idx
  on public.shopify_orders (organization_id, processed_at desc);
create index shopify_orders_org_creator_idx
  on public.shopify_orders (organization_id, creator_id, processed_at desc);

alter table public.shopify_orders enable row level security;
create policy shopify_orders_select_member
  on public.shopify_orders for select to authenticated
  using (public.is_organization_member(organization_id));

-- One commission per attributed order. "approved" is derived on read:
-- status = 'pending' and approvable_at <= now().
create table public.commissions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  creator_id       uuid not null references public.creators (id) on delete cascade,
  order_id         uuid not null unique references public.shopify_orders (id) on delete cascade,
  base_amount      numeric(14, 2) not null,
  rate             numeric(5, 2) not null,
  amount           numeric(14, 2) not null,
  currency         text not null default 'BRL',
  status           text not null
                     check (status in ('awaiting_payment', 'pending', 'paid', 'reversed')),
  approvable_at    timestamptz not null,
  paid_at          timestamptz,
  paid_by          uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index commissions_org_creator_idx
  on public.commissions (organization_id, creator_id, status);
create index commissions_org_status_idx
  on public.commissions (organization_id, status, approvable_at);

create trigger commissions_set_updated_at
  before update on public.commissions
  for each row execute function public.set_updated_at();

alter table public.commissions enable row level security;
create policy commissions_select_member
  on public.commissions for select to authenticated
  using (public.is_organization_member(organization_id));

-- ===========================================================================
-- 2. Internal helpers (no grants — callable only from definer functions)
-- ===========================================================================
create or replace function public.assert_shopify_ingest_key(p_org uuid, p_key text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_org is null or p_key is null or char_length(p_key) <> 64
     or not exists (
       select 1 from public.shopify_connections c
       where c.organization_id = p_org
         and c.status <> 'disconnected'
         and c.ingest_key_hash = encode(sha256(convert_to(p_key, 'UTF8')), 'hex')
     ) then
    raise exception 'FORBIDDEN';
  end if;
end;
$$;
revoke all on function public.assert_shopify_ingest_key(uuid, text) from public, anon, authenticated;

-- Coupon first, then UTM (last visit, then first visit). Case-insensitive.
create or replace function public.attribute_shopify_order(
  p_org uuid, p_codes text[], p_utm_last jsonb, p_utm_first jsonb
)
returns table (creator_id uuid, source text)
language sql
stable
security definer
set search_path = ''
as $$
  with a as (
    select ca.creator_id, ca.code
    from public.creator_affiliations ca
    where ca.organization_id = p_org and ca.active
  ), hits as (
    select a.creator_id, 'coupon'::text as source, 1 as prio
    from a
    where a.code = any (select upper(btrim(x)) from unnest(coalesce(p_codes, '{}')) x)
    union all
    select a.creator_id, 'utm_last', 2
    from a
    where a.code in (upper(btrim(p_utm_last->>'campaign')), upper(btrim(p_utm_last->>'content')))
    union all
    select a.creator_id, 'utm_first', 3
    from a
    where a.code in (upper(btrim(p_utm_first->>'campaign')), upper(btrim(p_utm_first->>'content')))
  )
  select h.creator_id, h.source from hits h order by h.prio limit 1;
$$;
revoke all on function public.attribute_shopify_order(uuid, text[], jsonb, jsonb) from public, anon, authenticated;

-- Re-run attribution on one stored order.
create or replace function public.reattribute_shopify_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.shopify_orders%rowtype;
  v_creator uuid;
  v_source  text;
begin
  select * into o from public.shopify_orders where id = p_order_id;
  if not found then return; end if;
  select a.creator_id, a.source into v_creator, v_source
  from public.attribute_shopify_order(o.organization_id, o.discount_codes, o.utm_last, o.utm_first) a;
  update public.shopify_orders
     set creator_id = v_creator, attribution = v_source
   where id = p_order_id
     and (creator_id is distinct from v_creator or attribution is distinct from v_source);
end;
$$;
revoke all on function public.reattribute_shopify_order(uuid) from public, anon, authenticated;

-- Keep the order's commission in step with the order. Paid commissions are
-- frozen (a refund after payout is a manual matter).
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
    select ca.commission_rate into v_rate
    from public.creator_affiliations ca
    where ca.organization_id = o.organization_id and ca.creator_id = o.creator_id;
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
revoke all on function public.refresh_shopify_commission(uuid) from public, anon, authenticated;

-- ===========================================================================
-- 3. Admin RPCs (session; authorization from auth.uid())
-- ===========================================================================
create or replace function public.shopify_connect(
  p_org               uuid,
  p_shop_domain       text,
  p_client_id         text,
  p_secret_enc        text,
  p_token_enc         text,
  p_token_expires_at  timestamptz,
  p_scopes            text,
  p_ingest_key_hash   text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_domain text := lower(btrim(coalesce(p_shop_domain, '')));
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_admin(p_org) then raise exception 'FORBIDDEN'; end if;
  if v_domain !~ '^[a-z0-9][a-z0-9-]*\.myshopify\.com$' then raise exception 'INVALID_SHOP_DOMAIN'; end if;
  if exists (
    select 1 from public.shopify_connections
    where shop_domain = v_domain and organization_id <> p_org and status <> 'disconnected'
  ) then
    raise exception 'SHOP_ALREADY_CONNECTED';
  end if;
  if coalesce(p_ingest_key_hash, '') !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_PAYLOAD'; end if;

  -- A disconnected row elsewhere may still hold the domain (unique).
  delete from public.shopify_connections
   where shop_domain = v_domain and organization_id <> p_org;

  insert into public.shopify_connections (
    organization_id, shop_domain, client_id, secret_enc, token_enc,
    token_expires_at, ingest_key_hash, scopes, status, last_error,
    webhooks_ok, connected_by
  ) values (
    p_org, v_domain, btrim(p_client_id), p_secret_enc, p_token_enc,
    p_token_expires_at, p_ingest_key_hash, left(p_scopes, 1000), 'connected', null,
    false, v_uid
  )
  on conflict (organization_id) do update set
    shop_domain      = excluded.shop_domain,
    client_id        = excluded.client_id,
    secret_enc       = excluded.secret_enc,
    token_enc        = excluded.token_enc,
    token_expires_at = excluded.token_expires_at,
    ingest_key_hash  = excluded.ingest_key_hash,
    scopes           = excluded.scopes,
    status           = 'connected',
    last_error       = null,
    webhooks_ok      = false,
    connected_by     = excluded.connected_by;

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.shopify_connect(uuid, text, text, text, text, timestamptz, text, text) from public;
grant execute on function public.shopify_connect(uuid, text, text, text, text, timestamptz, text, text) to authenticated;

create or replace function public.shopify_disconnect(p_org uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_admin(p_org) then raise exception 'FORBIDDEN'; end if;
  update public.shopify_connections set
    status = 'disconnected', secret_enc = null, token_enc = null,
    token_expires_at = null, ingest_key_hash = null, webhooks_ok = false
  where organization_id = p_org;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.shopify_disconnect(uuid) from public;
grant execute on function public.shopify_disconnect(uuid) to authenticated;

-- Safe status for any member (no ciphertext, no hashes).
create or replace function public.shopify_connection_status(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.shopify_connections%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_member(p_org) then raise exception 'FORBIDDEN'; end if;
  select * into r from public.shopify_connections where organization_id = p_org;
  if not found or r.status = 'disconnected' then
    return null;
  end if;
  return jsonb_build_object(
    'shop_domain', r.shop_domain,
    'status', r.status,
    'scopes', r.scopes,
    'webhooks_ok', r.webhooks_ok,
    'last_sync_at', r.last_sync_at,
    'last_error', r.last_error,
    'connected_at', r.created_at
  );
end;
$$;
revoke all on function public.shopify_connection_status(uuid) from public;
grant execute on function public.shopify_connection_status(uuid) to authenticated;

-- Ciphertexts for a member-triggered sync (server decrypts with its key).
create or replace function public.shopify_connection_secrets_for_org(p_org uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.shopify_connections%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_member(p_org) then raise exception 'FORBIDDEN'; end if;
  select * into r from public.shopify_connections
  where organization_id = p_org and status <> 'disconnected';
  if not found then return null; end if;
  return jsonb_build_object(
    'organization_id', r.organization_id, 'shop_domain', r.shop_domain,
    'client_id', r.client_id, 'secret_enc', r.secret_enc,
    'token_enc', r.token_enc, 'token_expires_at', r.token_expires_at
  );
end;
$$;
revoke all on function public.shopify_connection_secrets_for_org(uuid) from public;
grant execute on function public.shopify_connection_secrets_for_org(uuid) to authenticated;

-- Affiliate code + rate for a creator. Re-attributes the tenant's open orders
-- so sales made before the code was registered are picked up.
create or replace function public.set_creator_affiliation(
  p_org                 uuid,
  p_creator_id          uuid,
  p_code                text,
  p_commission_rate     numeric,
  p_discount_percent    numeric,
  p_shopify_discount_id text,
  p_active              boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  o record;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_admin(p_org) then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.creators where id = p_creator_id and organization_id = p_org) then
    raise exception 'CREATOR_NOT_FOUND';
  end if;
  if v_code !~ '^[A-Z0-9_-]{3,40}$' then raise exception 'INVALID_CODE'; end if;
  if p_commission_rate is null or p_commission_rate < 0 or p_commission_rate > 100 then
    raise exception 'INVALID_RATE';
  end if;
  if p_discount_percent is not null and (p_discount_percent < 0 or p_discount_percent > 100) then
    raise exception 'INVALID_DISCOUNT';
  end if;
  if exists (
    select 1 from public.creator_affiliations
    where organization_id = p_org and code = v_code and creator_id <> p_creator_id
  ) then
    raise exception 'CODE_TAKEN';
  end if;

  insert into public.creator_affiliations (
    organization_id, creator_id, code, commission_rate, discount_percent,
    shopify_discount_id, active
  ) values (
    p_org, p_creator_id, v_code, p_commission_rate, p_discount_percent,
    nullif(btrim(coalesce(p_shopify_discount_id, '')), ''), coalesce(p_active, true)
  )
  on conflict (organization_id, creator_id) do update set
    code                = excluded.code,
    commission_rate     = excluded.commission_rate,
    discount_percent    = excluded.discount_percent,
    shopify_discount_id = coalesce(excluded.shopify_discount_id, public.creator_affiliations.shopify_discount_id),
    active              = excluded.active;

  for o in
    select so.id from public.shopify_orders so
    left join public.commissions c on c.order_id = so.id
    where so.organization_id = p_org
      and so.processed_at > now() - interval '400 days'
      and (c.id is null or c.status <> 'paid')
  loop
    perform public.reattribute_shopify_order(o.id);
    perform public.refresh_shopify_commission(o.id);
  end loop;

  return jsonb_build_object('ok', true, 'code', v_code);
end;
$$;
revoke all on function public.set_creator_affiliation(uuid, uuid, text, numeric, numeric, text, boolean) from public;
grant execute on function public.set_creator_affiliation(uuid, uuid, text, numeric, numeric, text, boolean) to authenticated;

-- Pay out approved commissions (pending past the hold window).
create or replace function public.mark_commissions_paid(p_org uuid, p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_n integer;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_admin(p_org) then raise exception 'FORBIDDEN'; end if;
  if p_ids is null or array_length(p_ids, 1) is null or array_length(p_ids, 1) > 1000 then
    raise exception 'INVALID_PAYLOAD';
  end if;
  update public.commissions
     set status = 'paid', paid_at = now(), paid_by = v_uid
   where organization_id = p_org
     and id = any (p_ids)
     and status = 'pending'
     and approvable_at <= now();
  get diagnostics v_n = row_count;
  return jsonb_build_object('ok', true, 'paid', v_n);
end;
$$;
revoke all on function public.mark_commissions_paid(uuid, uuid[]) from public;
grant execute on function public.mark_commissions_paid(uuid, uuid[]) to authenticated;

create or replace function public.set_commission_hold_days(p_org uuid, p_days integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_admin(p_org) then raise exception 'FORBIDDEN'; end if;
  if p_days is null or p_days < 0 or p_days > 365 then raise exception 'INVALID_PAYLOAD'; end if;
  update public.organization_settings set commission_hold_days = p_days
   where organization_id = p_org;
  -- Unpaid commissions follow the new window.
  update public.commissions c
     set approvable_at = so.processed_at + make_interval(days => p_days)
    from public.shopify_orders so
   where c.order_id = so.id and c.organization_id = p_org and c.status <> 'paid';
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.set_commission_hold_days(uuid, integer) from public;
grant execute on function public.set_commission_hold_days(uuid, integer) to authenticated;

-- ===========================================================================
-- 4. Server-key RPCs (webhooks / sync; anon-callable, gated by ingest key)
-- ===========================================================================

-- Ciphertexts by shop domain, for the webhook route to find its connection.
create or replace function public.shopify_connection_secrets(p_shop_domain text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r public.shopify_connections%rowtype;
begin
  select * into r from public.shopify_connections
  where shop_domain = lower(btrim(coalesce(p_shop_domain, '')))
    and status <> 'disconnected';
  if not found then return null; end if;
  return jsonb_build_object(
    'organization_id', r.organization_id, 'shop_domain', r.shop_domain,
    'client_id', r.client_id, 'secret_enc', r.secret_enc,
    'token_enc', r.token_enc, 'token_expires_at', r.token_expires_at
  );
end;
$$;
revoke all on function public.shopify_connection_secrets(text) from public;
grant execute on function public.shopify_connection_secrets(text) to anon, authenticated;

create or replace function public.shopify_save_token(
  p_org uuid, p_ingest_key text, p_token_enc text, p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_shopify_ingest_key(p_org, p_ingest_key);
  update public.shopify_connections
     set token_enc = p_token_enc, token_expires_at = p_expires_at
   where organization_id = p_org;
end;
$$;
revoke all on function public.shopify_save_token(uuid, text, text, timestamptz) from public;
grant execute on function public.shopify_save_token(uuid, text, text, timestamptz) to anon, authenticated;

create or replace function public.shopify_record_sync(
  p_org uuid, p_ingest_key text, p_error text, p_webhooks_ok boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_shopify_ingest_key(p_org, p_ingest_key);
  update public.shopify_connections set
    last_sync_at = case when p_error is null then now() else last_sync_at end,
    last_error   = left(p_error, 500),
    status       = case when p_error is null then 'connected' else 'error' end,
    webhooks_ok  = coalesce(p_webhooks_ok, webhooks_ok)
  where organization_id = p_org;
end;
$$;
revoke all on function public.shopify_record_sync(uuid, text, text, boolean) from public;
grant execute on function public.shopify_record_sync(uuid, text, text, boolean) to anon, authenticated;

-- The app was uninstalled from the store: stop using the connection.
create or replace function public.shopify_mark_uninstalled(p_org uuid, p_ingest_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_shopify_ingest_key(p_org, p_ingest_key);
  update public.shopify_connections set
    status = 'disconnected', secret_enc = null, token_enc = null,
    token_expires_at = null, ingest_key_hash = null, webhooks_ok = false,
    last_error = 'App desinstalado da loja.'
  where organization_id = p_org;
end;
$$;
revoke all on function public.shopify_mark_uninstalled(uuid, text) from public;
grant execute on function public.shopify_mark_uninstalled(uuid, text) to anon, authenticated;

-- Upsert a batch of orders (≤ 250), attribute them and refresh commissions.
-- UTM fields are merged: a null in the payload keeps what was stored (the
-- customer journey can arrive up to 48h after the order).
create or replace function public.shopify_ingest_orders(
  p_org uuid, p_ingest_key text, p_orders jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o     jsonb;
  v_id  uuid;
  v_n   integer := 0;
begin
  perform public.assert_shopify_ingest_key(p_org, p_ingest_key);
  if p_orders is null or jsonb_typeof(p_orders) <> 'array' then raise exception 'INVALID_PAYLOAD'; end if;
  if jsonb_array_length(p_orders) > 250 then raise exception 'PAYLOAD_TOO_LARGE'; end if;
  if octet_length(p_orders::text) > 2000000 then raise exception 'PAYLOAD_TOO_LARGE'; end if;

  for o in select value from jsonb_array_elements(p_orders) loop
    if jsonb_typeof(o) <> 'object' or nullif(o->>'id', '') is null
       or nullif(o->>'processed_at', '') is null then
      raise exception 'INVALID_PAYLOAD';
    end if;

    insert into public.shopify_orders as so (
      organization_id, shopify_order_id, name, processed_at, cancelled_at,
      financial_status, currency, subtotal, total_discounts, total_refunded,
      discount_codes, utm_last, utm_first, test, synced_at
    ) values (
      p_org,
      left(o->>'id', 100),
      left(o->>'name', 60),
      (o->>'processed_at')::timestamptz,
      nullif(o->>'cancelled_at', '')::timestamptz,
      left(o->>'financial_status', 40),
      coalesce(left(nullif(o->>'currency', ''), 8), 'BRL'),
      coalesce(nullif(o->>'subtotal', '')::numeric, 0),
      coalesce(nullif(o->>'total_discounts', '')::numeric, 0),
      coalesce(nullif(o->>'total_refunded', '')::numeric, 0),
      coalesce(
        array(select left(x, 100) from jsonb_array_elements_text(
          case when jsonb_typeof(o->'discount_codes') = 'array' then o->'discount_codes' else '[]'::jsonb end
        ) x limit 20),
        '{}'
      ),
      case when jsonb_typeof(o->'utm_last') = 'object' then o->'utm_last' end,
      case when jsonb_typeof(o->'utm_first') = 'object' then o->'utm_first' end,
      coalesce((o->>'test')::boolean, false),
      now()
    )
    on conflict (organization_id, shopify_order_id) do update set
      name             = excluded.name,
      processed_at     = excluded.processed_at,
      cancelled_at     = excluded.cancelled_at,
      financial_status = excluded.financial_status,
      currency         = excluded.currency,
      subtotal         = excluded.subtotal,
      total_discounts  = excluded.total_discounts,
      total_refunded   = excluded.total_refunded,
      discount_codes   = excluded.discount_codes,
      utm_last         = coalesce(excluded.utm_last, so.utm_last),
      utm_first        = coalesce(excluded.utm_first, so.utm_first),
      test             = excluded.test,
      synced_at        = now()
    returning so.id into v_id;

    -- A paid commission freezes the attribution too.
    if not exists (select 1 from public.commissions where order_id = v_id and status = 'paid') then
      perform public.reattribute_shopify_order(v_id);
    end if;
    perform public.refresh_shopify_commission(v_id);
    v_n := v_n + 1;
  end loop;

  return jsonb_build_object('ok', true, 'orders', v_n);
end;
$$;
revoke all on function public.shopify_ingest_orders(uuid, text, jsonb) from public;
grant execute on function public.shopify_ingest_orders(uuid, text, jsonb) to anon, authenticated;
