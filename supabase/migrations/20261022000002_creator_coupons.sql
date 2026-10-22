-- Zoviah — a creator's two coupons.
--
-- 1. The affiliate (commissioned) coupon may be linked before its commission
--    rate is agreed: commission_rate becomes nullable. A NULL rate still
--    attributes the orders to the creator, but refresh_shopify_commission
--    already creates no commission row for it.
-- 2. creator_personal_coupons: the creator's own discount code. It is never
--    attributed (attribute_shopify_order reads creator_affiliations only), so
--    it earns no commission and its orders never count as her sales. A code
--    can't be both an affiliate code and a personal code in the same org.

-- ===========================================================================
-- 1. commission rate optional
-- ===========================================================================
alter table public.creator_affiliations
  alter column commission_rate drop not null;

-- ===========================================================================
-- 2. personal coupons
-- ===========================================================================
create table public.creator_personal_coupons (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations (id) on delete cascade,
  creator_id          uuid not null references public.creators (id) on delete cascade,
  code                text not null check (code ~ '^[A-Z0-9_-]{3,40}$'),
  discount_percent    numeric(5, 2) check (discount_percent is null or discount_percent between 0 and 100),
  shopify_discount_id text check (shopify_discount_id is null or char_length(shopify_discount_id) <= 200),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (organization_id, creator_id),
  unique (organization_id, code)
);

create trigger creator_personal_coupons_set_updated_at
  before update on public.creator_personal_coupons
  for each row execute function public.set_updated_at();

alter table public.creator_personal_coupons enable row level security;
create policy creator_personal_coupons_select_member
  on public.creator_personal_coupons for select to authenticated
  using (public.is_organization_member(organization_id));
-- Writes only through set_creator_personal_coupon.

-- ===========================================================================
-- set_creator_affiliation — rate may be NULL; code can't be a personal code
-- ===========================================================================
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
  if p_commission_rate is not null and (p_commission_rate < 0 or p_commission_rate > 100) then
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
  if exists (
    select 1 from public.creator_personal_coupons
    where organization_id = p_org and code = v_code
  ) then
    raise exception 'CODE_IS_PERSONAL';
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

-- ===========================================================================
-- set_creator_personal_coupon — empty code removes it
-- ===========================================================================
create or replace function public.set_creator_personal_coupon(
  p_creator_id          uuid,
  p_code                text,
  p_discount_percent    numeric,
  p_shopify_discount_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_org   uuid;
  v_code  text := upper(btrim(coalesce(p_code, '')));
  v_actor text;
  v_old   text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select organization_id into v_org from public.creators where id = p_creator_id;
  if v_org is null then raise exception 'CREATOR_NOT_FOUND'; end if;
  if not public.is_organization_admin(v_org) then raise exception 'FORBIDDEN'; end if;

  select code into v_old from public.creator_personal_coupons
  where organization_id = v_org and creator_id = p_creator_id;

  if v_code = '' then
    delete from public.creator_personal_coupons
    where organization_id = v_org and creator_id = p_creator_id;
  else
    if v_code !~ '^[A-Z0-9_-]{3,40}$' then raise exception 'INVALID_CODE'; end if;
    if p_discount_percent is not null and (p_discount_percent < 0 or p_discount_percent > 100) then
      raise exception 'INVALID_DISCOUNT';
    end if;
    if exists (
      select 1 from public.creator_personal_coupons
      where organization_id = v_org and code = v_code and creator_id <> p_creator_id
    ) then
      raise exception 'CODE_TAKEN';
    end if;
    if exists (
      select 1 from public.creator_affiliations
      where organization_id = v_org and code = v_code
    ) then
      raise exception 'CODE_IS_AFFILIATE';
    end if;

    insert into public.creator_personal_coupons (
      organization_id, creator_id, code, discount_percent, shopify_discount_id
    ) values (
      v_org, p_creator_id, v_code, p_discount_percent,
      nullif(btrim(coalesce(p_shopify_discount_id, '')), '')
    )
    on conflict (organization_id, creator_id) do update set
      code                = excluded.code,
      discount_percent    = excluded.discount_percent,
      shopify_discount_id = case
        when public.creator_personal_coupons.code = excluded.code
          then coalesce(excluded.shopify_discount_id, public.creator_personal_coupons.shopify_discount_id)
        else excluded.shopify_discount_id
      end;
  end if;

  if v_old is distinct from nullif(v_code, '') then
    select email into v_actor from auth.users where id = v_uid;
    insert into public.creator_events
      (organization_id, creator_id, type, actor_user_id, data)
    values (
      v_org, p_creator_id, 'personal_coupon_set', v_uid,
      jsonb_build_object('code', nullif(v_code, ''), 'actor_email', v_actor)
    );
  end if;

  return jsonb_build_object('ok', true, 'code', nullif(v_code, ''));
end;
$$;

revoke all on function public.set_creator_personal_coupon(uuid, text, numeric, text) from public;
grant execute on function public.set_creator_personal_coupon(uuid, text, numeric, text) to authenticated;
