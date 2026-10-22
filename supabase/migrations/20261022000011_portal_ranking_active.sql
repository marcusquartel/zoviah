-- Zoviah — ranking rows say whether each creator sold this month ("active"),
-- so the portal podium only shows creators with sales. Still no values for
-- anyone but the caller.

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
  v_set    public.organization_settings%rowtype;
  v_streak integer := 0;
  v_m      timestamptz;
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
           'active', r.orders > 0,
           'sales', case when r.creator_id = v_c.id then r.sales end,
           'orders', case when r.creator_id = v_c.id then r.orders end
         ) order by r.rank_position, r.display_name), '[]'::jsonb)
    into v_rank_all
    from public.portal_ranking(v_c.organization_id, null, v_month) r;

  if v_c.tier_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'position', r.rank_position, 'name', r.display_name, 'tier', r.tier_name,
             'me', r.creator_id = v_c.id,
           'active', r.orders > 0,
             'sales', case when r.creator_id = v_c.id then r.sales end,
             'orders', case when r.creator_id = v_c.id then r.orders end
           ) order by r.rank_position, r.display_name), '[]'::jsonb)
      into v_rank_tier
      from public.portal_ranking(v_c.organization_id, v_c.tier_id, v_month) r;
  end if;

  select * into v_set from public.organization_settings where organization_id = v_c.organization_id;

  -- Consecutive months with at least one paid sale, counting back from this
  -- month (or from last month when this one has none yet).
  v_m := v_month;
  if not exists (
    select 1 from public.shopify_orders o
    where o.creator_id = v_c.id and not o.test and o.cancelled_at is null
      and upper(coalesce(o.financial_status, '')) in ('PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED')
      and o.processed_at >= v_m
  ) then
    v_m := ((date_trunc('month', (v_month - interval '1 day') at time zone 'America/Sao_Paulo'))
            at time zone 'America/Sao_Paulo');
  end if;
  while v_streak < 24 and exists (
    select 1 from public.shopify_orders o
    where o.creator_id = v_c.id and not o.test and o.cancelled_at is null
      and upper(coalesce(o.financial_status, '')) in ('PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED')
      and o.processed_at >= v_m
      and o.processed_at < ((date_trunc('month', (v_m + interval '32 days') at time zone 'America/Sao_Paulo'))
                            at time zone 'America/Sao_Paulo')
  ) loop
    v_streak := v_streak + 1;
    v_m := ((date_trunc('month', (v_m - interval '1 day') at time zone 'America/Sao_Paulo'))
            at time zone 'America/Sao_Paulo');
  end loop;

  return jsonb_build_object(
    'creator', jsonb_build_object(
      'name', coalesce(nullif(btrim(v_c.preferred_name), ''), split_part(v_c.full_name, ' ', 1)),
      'full_name', v_c.full_name,
      'avatar_url', v_c.avatar_url),
    'branding', jsonb_build_object(
      'primary_color', v_set.primary_color,
      'secondary_color', v_set.secondary_color,
      'logo_url', v_set.logo_url),
    'streak_months', v_streak,
    'totals', (
      select jsonb_build_object('orders', count(o.id), 'sales', coalesce(sum(o.subtotal), 0))
      from public.shopify_orders o
      where o.creator_id = v_c.id and not o.test and o.cancelled_at is null
        and upper(coalesce(o.financial_status, '')) in ('PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED')),
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
