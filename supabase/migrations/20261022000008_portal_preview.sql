-- Zoviah — staff preview of a creator's portal ("ver como ela vê").
--
-- The portal payload moves to an internal portal_dashboard_data (no caller
-- check, never granted). Two doors in:
--   portal_dashboard          — the creator herself (creator_portal_users)
--   portal_dashboard_preview  — owner/admin of the creator's organization
-- Same payload, so the preview is exactly what she sees.

create or replace function public.portal_dashboard_data(p_creator_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_c      public.creators%rowtype;
  v_org    public.organizations%rowtype;
  v_tier   public.creator_tiers%rowtype;
  v_aff    public.creator_affiliations%rowtype;
  v_pers   public.creator_personal_coupons%rowtype;
  v_month  timestamptz := (date_trunc('month', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
  v_rank_all  jsonb;
  v_rank_tier jsonb;
begin

  select * into v_c from public.creators where id = p_creator_id and archived_at is null;
  if v_c.id is null then raise exception 'FORBIDDEN'; end if;
  select * into v_org from public.organizations where id = v_c.organization_id;
  if v_org.status = 'suspended' then raise exception 'FORBIDDEN'; end if;
  select * into v_tier from public.creator_tiers where id = v_c.tier_id;
  select * into v_aff from public.creator_affiliations
   where organization_id = v_c.organization_id and creator_id = v_c.id;
  select * into v_pers from public.creator_personal_coupons
   where organization_id = v_c.organization_id and creator_id = v_c.id;

  -- Ranking rows: name + position for everyone, numbers only for her.
  select coalesce(jsonb_agg(jsonb_build_object(
           'position', r.rank_position, 'name', r.display_name, 'tier', r.tier_name,
           'me', r.creator_id = v_c.id,
           'sales', case when r.creator_id = v_c.id then r.sales end,
           'orders', case when r.creator_id = v_c.id then r.orders end
         ) order by r.rank_position, r.display_name), '[]'::jsonb)
    into v_rank_all
    from public.portal_ranking(v_c.organization_id, null, v_month) r;

  if v_c.tier_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'position', r.rank_position, 'name', r.display_name, 'tier', r.tier_name,
             'me', r.creator_id = v_c.id,
             'sales', case when r.creator_id = v_c.id then r.sales end,
             'orders', case when r.creator_id = v_c.id then r.orders end
           ) order by r.rank_position, r.display_name), '[]'::jsonb)
      into v_rank_tier
      from public.portal_ranking(v_c.organization_id, v_c.tier_id, v_month) r;
  end if;

  return jsonb_build_object(
    'creator', jsonb_build_object(
      'name', coalesce(nullif(btrim(v_c.preferred_name), ''), split_part(v_c.full_name, ' ', 1)),
      'full_name', v_c.full_name),
    'organization', jsonb_build_object('name', v_org.name),
    'tier', case when v_tier.id is null then null
                 else jsonb_build_object('name', v_tier.name, 'commission_rate', v_tier.commission_rate,
                                         'description', v_tier.description) end,
    'commission_rate', public.creator_commission_rate(v_c.organization_id, v_c.id),
    'coupons', jsonb_build_object(
      'affiliate', case when v_aff.id is null then null
                        else jsonb_build_object('code', v_aff.code, 'discount_percent', v_aff.discount_percent,
                                                'active', v_aff.active) end,
      'personal', case when v_pers.id is null then null
                       else jsonb_build_object('code', v_pers.code, 'discount_percent', v_pers.discount_percent) end),
    'month', (
      select jsonb_build_object(
        'from', v_month,
        'orders', count(o.id),
        'sales', coalesce(sum(o.subtotal), 0),
        'commission', coalesce(sum(cm.amount) filter (where cm.status <> 'reversed'), 0))
      from public.shopify_orders o
      left join public.commissions cm on cm.order_id = o.id
      where o.creator_id = v_c.id and not o.test and o.cancelled_at is null
        and upper(coalesce(o.financial_status, '')) in ('PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED')
        and o.processed_at >= v_month),
    'commissions', (
      select jsonb_build_object(
        'awaiting_payment', coalesce(sum(amount) filter (where status = 'awaiting_payment'), 0),
        'in_hold', coalesce(sum(amount) filter (where status = 'pending' and approvable_at > now()), 0),
        'available', coalesce(sum(amount) filter (where status = 'pending' and approvable_at <= now()), 0),
        'paid', coalesce(sum(amount) filter (where status = 'paid'), 0))
      from public.commissions where creator_id = v_c.id and organization_id = v_c.organization_id),
    'recent_orders', (
      select coalesce(jsonb_agg(x order by x->>'processed_at' desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'name', o.name, 'processed_at', o.processed_at, 'subtotal', o.subtotal,
          'currency', o.currency, 'cancelled', o.cancelled_at is not null,
          'commission', cm.amount,
          'commission_status', case
            when cm.id is null then null
            when cm.status = 'pending' and cm.approvable_at <= now() then 'available'
            when cm.status = 'pending' then 'in_hold'
            else cm.status end) as x
        from public.shopify_orders o
        left join public.commissions cm on cm.order_id = o.id
        where o.creator_id = v_c.id and not o.test
        order by o.processed_at desc
        limit 15) s),
    'ranking', jsonb_build_object('all', v_rank_all, 'tier', v_rank_tier)
  );
end;
$$;
revoke all on function public.portal_dashboard_data(uuid) from public, anon, authenticated;

create or replace function public.portal_dashboard(p_creator_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (
    select 1 from public.creator_portal_users
    where creator_id = p_creator_id and user_id = (select auth.uid())
  ) then
    raise exception 'FORBIDDEN';
  end if;
  return public.portal_dashboard_data(p_creator_id);
end;
$$;

create or replace function public.portal_dashboard_preview(p_creator_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_org uuid;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select organization_id into v_org from public.creators where id = p_creator_id;
  if v_org is null or not public.is_organization_admin(v_org) then
    raise exception 'FORBIDDEN';
  end if;
  return public.portal_dashboard_data(p_creator_id);
end;
$$;
revoke all on function public.portal_dashboard_preview(uuid) from public;
grant execute on function public.portal_dashboard_preview(uuid) to authenticated;
