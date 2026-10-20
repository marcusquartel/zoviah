-- Zoviah — bulk-import current influencers from the store's existing coupons.
--
-- import_creator_affiliations(org, items) takes up to 200
--   { name, code, commission_rate, discount_percent?, shopify_discount_id?, instagram? }
-- and, for each item whose code is not linked yet:
--   * reuses the creator with the same name (case-insensitive, unique match)
--     or creates one;
--   * gives the creator an APPROVED application in the internal draft program
--     "Influenciadoras atuais" (created on demand; draft = no public form), so
--     they show up in the CRM, shipments, etc.;
--   * links the existing Shopify coupon as the creator's affiliate code (no
--     new coupon is created).
-- Then re-attributes the tenant's unpaid orders so past sales count.
-- Admin-only; authorization re-derived from auth.uid().

create or replace function public.import_creator_affiliations(p_org uuid, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_program   uuid;
  it          jsonb;
  v_name      text;
  v_code      text;
  v_rate      numeric;
  v_disc      numeric;
  v_ig        text;
  v_creator   uuid;
  v_imported  integer := 0;
  v_skipped   integer := 0;
  o           record;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_admin(p_org) then raise exception 'FORBIDDEN'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'INVALID_PAYLOAD'; end if;
  if jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 200 then
    raise exception 'INVALID_PAYLOAD';
  end if;

  select id into v_program from public.programs
  where organization_id = p_org and slug = 'influenciadoras-atuais';
  if v_program is null then
    insert into public.programs (organization_id, name, slug, status, description)
    values (p_org, 'Influenciadoras atuais', 'influenciadoras-atuais', 'draft',
            'Parcerias que já existiam antes do Zoviah, importadas dos cupons da loja.')
    returning id into v_program;
  end if;

  for it in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(it) <> 'object' then raise exception 'INVALID_PAYLOAD'; end if;
    v_name := btrim(coalesce(it->>'name', ''));
    v_code := upper(btrim(coalesce(it->>'code', '')));
    v_rate := nullif(it->>'commission_rate', '')::numeric;
    v_disc := nullif(it->>'discount_percent', '')::numeric;
    v_ig   := nullif(lower(regexp_replace(btrim(coalesce(it->>'instagram', '')), '^@', '')), '');

    if char_length(v_name) not between 1 and 150 then raise exception 'INVALID_NAME'; end if;
    if v_code !~ '^[A-Z0-9_-]{3,40}$' then raise exception 'INVALID_CODE'; end if;
    if v_rate is null or v_rate < 0 or v_rate > 100 then raise exception 'INVALID_RATE'; end if;
    if v_disc is not null and (v_disc < 0 or v_disc > 100) then raise exception 'INVALID_DISCOUNT'; end if;
    if v_ig is not null and v_ig !~ '^[a-z0-9._]{1,30}$' then v_ig := null; end if;

    if exists (select 1 from public.creator_affiliations where organization_id = p_org and code = v_code) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    -- Reuse a creator only on an unambiguous, not-yet-affiliated name match.
    v_creator := null;
    select c.id into v_creator
    from public.creators c
    where c.organization_id = p_org
      and lower(c.full_name) = lower(v_name)
      and c.archived_at is null
      and not exists (select 1 from public.creator_affiliations a where a.creator_id = c.id)
      and (select count(*) from public.creators c2
           where c2.organization_id = p_org and lower(c2.full_name) = lower(v_name)
             and c2.archived_at is null) = 1;

    if v_creator is null then
      insert into public.creators (organization_id, full_name)
      values (p_org, v_name)
      returning id into v_creator;
    end if;

    if v_ig is not null then
      insert into public.creator_social_profiles (
        organization_id, creator_id, platform, handle, handle_normalized, profile_url
      ) values (
        p_org, v_creator, 'instagram', v_ig, v_ig, 'https://instagram.com/' || v_ig
      )
      on conflict (organization_id, platform, handle_normalized) do nothing;
    end if;

    if not exists (
      select 1 from public.applications
      where organization_id = p_org and program_id = v_program and creator_id = v_creator
    ) then
      insert into public.applications (
        organization_id, program_id, creator_id, status, form_version,
        source, submitted_at, approved_at
      ) values (
        p_org, v_program, v_creator, 'approved', 1, 'import', now(), now()
      );
    end if;

    insert into public.creator_affiliations (
      organization_id, creator_id, code, commission_rate, discount_percent,
      shopify_discount_id, active
    ) values (
      p_org, v_creator, v_code, v_rate, v_disc,
      nullif(left(btrim(coalesce(it->>'shopify_discount_id', '')), 200), ''), true
    );

    insert into public.creator_events (organization_id, creator_id, type, actor_user_id, data)
    values (p_org, v_creator, 'affiliation_imported', v_uid,
            jsonb_build_object('code', v_code, 'commission_rate', v_rate));

    v_imported := v_imported + 1;
  end loop;

  if v_imported > 0 then
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
  end if;

  return jsonb_build_object('ok', true, 'imported', v_imported, 'skipped', v_skipped);
end;
$$;

revoke all on function public.import_creator_affiliations(uuid, jsonb) from public;
grant execute on function public.import_creator_affiliations(uuid, jsonb) to authenticated;
