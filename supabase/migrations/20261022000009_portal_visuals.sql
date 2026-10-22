-- Zoviah — portal visuals: creator photo, brand colors, gamification inputs.
--
-- 1. creators.avatar_url + public bucket "creator-avatars". Path (changed to
--    <creator_id>/<file> in 20261022000010). Writes allowed to owner/admin of
--    that org or to the creator herself (portal user); the URL is then saved
--    through set_creator_avatar with the same check.
-- 2. portal_dashboard_data adds branding (brand colors / logo), avatar_url,
--    all-time totals and the streak of consecutive months with sales — the
--    inputs for badges, computed from her own data only.

alter table public.creators add column avatar_url text
  check (avatar_url is null or char_length(avatar_url) <= 500);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creator-avatars', 'creator-avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Who may write <org>/<creator>/... : org owner/admin, or that creator's portal user.
create or replace function public.can_write_creator_avatar(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.creators c
    where c.id::text = (storage.foldername(p_name))[2]
      and c.organization_id::text = (storage.foldername(p_name))[1]
      and (
        public.is_organization_admin(c.organization_id)
        or exists (
          select 1 from public.creator_portal_users pu
          where pu.creator_id = c.id and pu.user_id = (select auth.uid())
        )
      )
  );
$$;
revoke all on function public.can_write_creator_avatar(text) from public, anon;
grant execute on function public.can_write_creator_avatar(text) to authenticated;

drop policy if exists "creator-avatars public read" on storage.objects;
create policy "creator-avatars public read"
  on storage.objects for select
  using (bucket_id = 'creator-avatars');

drop policy if exists "creator-avatars write" on storage.objects;
create policy "creator-avatars write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'creator-avatars' and public.can_write_creator_avatar(name));

drop policy if exists "creator-avatars update" on storage.objects;
create policy "creator-avatars update"
  on storage.objects for update to authenticated
  using (bucket_id = 'creator-avatars' and public.can_write_creator_avatar(name))
  with check (bucket_id = 'creator-avatars' and public.can_write_creator_avatar(name));

drop policy if exists "creator-avatars delete" on storage.objects;
create policy "creator-avatars delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'creator-avatars' and public.can_write_creator_avatar(name));

-- Saves the public URL of an uploaded photo (or null to remove it). Only URLs
-- of this creator's own folder in the bucket are accepted.
create or replace function public.set_creator_avatar(p_creator_id uuid, p_url text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select organization_id into v_org from public.creators where id = p_creator_id;
  if v_org is null then raise exception 'CREATOR_NOT_FOUND'; end if;
  if not public.can_write_creator_avatar(v_org::text || '/' || p_creator_id::text || '/x') then
    raise exception 'FORBIDDEN';
  end if;
  if v_url is not null and (
       char_length(v_url) > 500
       or position('/storage/v1/object/public/creator-avatars/' || v_org::text || '/' || p_creator_id::text || '/' in v_url) = 0
     ) then
    raise exception 'INVALID_URL';
  end if;
  update public.creators set avatar_url = v_url, updated_at = now() where id = p_creator_id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.set_creator_avatar(uuid, text) from public;
grant execute on function public.set_creator_avatar(uuid, text) to authenticated;

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
