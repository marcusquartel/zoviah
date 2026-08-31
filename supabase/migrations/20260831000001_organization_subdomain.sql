-- Zoviah — Phase 8A adjustment: tenant SUBDOMAIN identity, separate from SLUG.
--
-- `organizations.slug` stays exactly as it is — it identifies the org in the
-- public form URLs (`/p/<slug>/<programSlug>`) and anywhere else it is already
-- used. Changing it would break existing links, so we do not touch it.
--
-- This migration adds a dedicated `organizations.subdomain` used ONLY for the
-- tenant host `<subdomain>.zoviah.app`. Rare Way keeps `slug = 'rare-way'` and
-- gains `subdomain = 'rareway'`.
--
--   name       = Rare Way
--   slug       = rare-way      -> zoviah.app/p/rare-way/...
--   subdomain  = rareway       -> rareway.zoviah.app
--
-- No earlier migration is edited. Nothing here relaxes RLS: the subdomain
-- selects the org CONTEXT; membership + RLS remain the authorization barrier.

-- ===========================================================================
-- 1. Column + constraints
-- ===========================================================================

alter table public.organizations
  add column if not exists subdomain text;

-- DNS label shape (same rule as slug) and length. NULL is allowed: an org
-- without a subdomain simply has no tenant host yet.
alter table public.organizations
  drop constraint if exists organizations_subdomain_format_check;
alter table public.organizations
  add constraint organizations_subdomain_format_check
  check (
    subdomain is null
    or (
      subdomain = lower(subdomain)
      and subdomain ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      and char_length(subdomain) between 1 and 63
    )
  );

-- Unique across all non-NULL values (partial index — many NULLs are fine).
drop index if exists organizations_subdomain_key;
create unique index organizations_subdomain_key
  on public.organizations (subdomain)
  where subdomain is not null;

comment on column public.organizations.subdomain is
  'Tenant host label: <subdomain>.zoviah.app. Distinct from slug (public form '
  'URLs). DNS-safe, lowercase, unique. Reserved labels are rejected by the '
  'application (src/lib/tenant/host.ts is the source of truth) and by the '
  'admin RPCs below.';

-- ===========================================================================
-- 2. Backfill — Rare Way only, explicit value (no automatic hyphen-stripping)
-- ===========================================================================

update public.organizations
set subdomain = 'rareway'
where slug = 'rare-way' and subdomain is null;

-- ===========================================================================
-- 3. Reserved-label guard (DB backstop for the RPCs below)
-- ===========================================================================

-- Kept in sync with RESERVED_SUBDOMAINS in src/lib/tenant/host.ts. The app is
-- the source of truth; this is defense in depth for the platform-admin RPCs.
create or replace function public.is_reserved_subdomain(p_label text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(coalesce(p_label, '')) in (
    'www','app','admin','api','auth','static','assets','cdn','img','images',
    'media','mail','email','smtp','ftp','ns','ns1','ns2','dns','vpn','status',
    'docs','blog','help','support','dashboard','billing','internal','test',
    'staging','dev','preview'
  );
$$;

-- ===========================================================================
-- 4. admin_create_organization — gains p_subdomain (7th arg -> new signature)
-- ===========================================================================

drop function if exists public.admin_create_organization(
  text, text, text, text, text, text
);

create or replace function public.admin_create_organization(
  p_name           text,
  p_slug           text,
  p_owner_email    text,
  p_plan_code      text,
  p_status         text,
  p_owner_token_hash text,
  p_subdomain      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_name  text := btrim(coalesce(p_name, ''));
  v_slug  text := lower(btrim(coalesce(p_slug, '')));
  v_sub   text := nullif(lower(btrim(coalesce(p_subdomain, ''))), '');
  v_email text := lower(btrim(coalesce(p_owner_email, '')));
  v_plan  text := coalesce(nullif(btrim(p_plan_code), ''), 'founding');
  v_status text := coalesce(nullif(btrim(p_status), ''), 'active');
  v_org   uuid;
  v_owner uuid;
  v_invite uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;

  if char_length(v_name) < 2 or char_length(v_name) > 120 then
    raise exception 'INVALID_NAME';
  end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_slug) > 63 then
    raise exception 'INVALID_SLUG';
  end if;
  if exists (select 1 from public.organizations where slug = v_slug) then
    raise exception 'SLUG_TAKEN';
  end if;

  if v_sub is not null then
    if v_sub !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_sub) > 63 then
      raise exception 'INVALID_SUBDOMAIN';
    end if;
    if public.is_reserved_subdomain(v_sub) then
      raise exception 'SUBDOMAIN_RESERVED';
    end if;
    if exists (select 1 from public.organizations where subdomain = v_sub) then
      raise exception 'SUBDOMAIN_TAKEN';
    end if;
  end if;

  if v_plan not in ('founding', 'starter', 'pro', 'agency', 'enterprise') then
    raise exception 'INVALID_PLAN';
  end if;
  if v_status not in ('active', 'suspended') then
    raise exception 'INVALID_STATUS';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'INVALID_OWNER_EMAIL';
  end if;
  if p_owner_token_hash is null or char_length(p_owner_token_hash) <> 64 then
    raise exception 'BAD_TOKEN_HASH';
  end if;

  insert into public.organizations (name, slug, subdomain, status)
  values (v_name, v_slug, v_sub, v_status)
  returning id into v_org;
  -- triggers create organization_settings + organization_subscriptions

  update public.organization_subscriptions
  set plan_code = v_plan, updated_by = v_uid, started_at = now()
  where organization_id = v_org;

  select id into v_owner from auth.users where lower(email) = v_email;

  if v_owner is not null then
    insert into public.organization_members (organization_id, user_id, role)
    values (v_org, v_owner, 'owner');
  else
    insert into public.organization_invites (
      organization_id, email, role, token_hash, status, expires_at, invited_by
    ) values (
      v_org, v_email, 'owner', p_owner_token_hash, 'pending',
      now() + interval '14 days', v_uid
    )
    returning id into v_invite;
  end if;

  insert into public.platform_audit_events (actor_user_id, organization_id, event_type, metadata)
  values (v_uid, v_org, 'organization_created',
    jsonb_build_object('plan_code', v_plan, 'status', v_status,
      'subdomain', v_sub,
      'owner_pending', (v_owner is null)));

  return jsonb_build_object('ok', true, 'organization_id', v_org,
    'owner_user_id', v_owner, 'owner_invite_pending', (v_owner is null));
end;
$$;

revoke all on function public.admin_create_organization(text, text, text, text, text, text, text) from public;
grant execute on function public.admin_create_organization(text, text, text, text, text, text, text) to authenticated;

-- ===========================================================================
-- 5. admin_set_organization_subdomain — set / change / clear the tenant host
-- ===========================================================================

create or replace function public.admin_set_organization_subdomain(
  p_organization_id uuid,
  p_subdomain       text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_sub text := nullif(lower(btrim(coalesce(p_subdomain, ''))), '');
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'ORGANIZATION_NOT_FOUND';
  end if;

  if v_sub is not null then
    if v_sub !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(v_sub) > 63 then
      raise exception 'INVALID_SUBDOMAIN';
    end if;
    if public.is_reserved_subdomain(v_sub) then
      raise exception 'SUBDOMAIN_RESERVED';
    end if;
    if exists (
      select 1 from public.organizations
      where subdomain = v_sub and id <> p_organization_id
    ) then
      raise exception 'SUBDOMAIN_TAKEN';
    end if;
  end if;

  update public.organizations
  set subdomain = v_sub
  where id = p_organization_id;

  insert into public.platform_audit_events (actor_user_id, organization_id, event_type, metadata)
  values (v_uid, p_organization_id, 'organization_subdomain_updated',
    jsonb_build_object('subdomain', v_sub));

  return jsonb_build_object('ok', true, 'subdomain', v_sub);
end;
$$;

revoke all on function public.admin_set_organization_subdomain(uuid, text) from public;
grant execute on function public.admin_set_organization_subdomain(uuid, text) to authenticated;

-- ===========================================================================
-- 6. admin_get_organization / admin_list_organizations — expose subdomain
-- ===========================================================================

-- Re-created (same signature) — body is the 20260830000004 version plus
-- `subdomain`.
create or replace function public.admin_get_organization(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row jsonb;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;

  select jsonb_build_object(
    'id', o.id, 'name', o.name, 'slug', o.slug, 'subdomain', o.subdomain,
    'status', o.status, 'created_at', o.created_at,
    'plan_code', s.plan_code, 'started_at', s.started_at,
    'expires_at', s.expires_at, 'notes', s.notes,
    'logo_url', st.logo_url, 'favicon_url', st.favicon_url,
    'users_count', (select count(*) from public.organization_members m where m.organization_id = o.id),
    'creators_count', (select count(*) from public.creators c where c.organization_id = o.id),
    'programs_count', (select count(*) from public.programs pr where pr.organization_id = o.id),
    'applications_count', (select count(*) from public.applications a where a.organization_id = o.id),
    'analyses_count', (select count(*) from public.creator_analyses an where an.organization_id = o.id),
    'shipments_count', (select count(*) from public.shipments sh where sh.organization_id = o.id),
    'pending_invites', (select count(*) from public.organization_invites i where i.organization_id = o.id and i.status = 'pending')
  )
  into v_row
  from public.organizations o
  left join public.organization_subscriptions s on s.organization_id = o.id
  left join public.organization_settings st on st.organization_id = o.id
  where o.id = p_organization_id;

  if v_row is null then raise exception 'ORGANIZATION_NOT_FOUND'; end if;
  return v_row;
end;
$$;

revoke all on function public.admin_get_organization(uuid) from public;
grant execute on function public.admin_get_organization(uuid) to authenticated;

-- Re-created (same signature) — body is the 20260830000001 version plus
-- `subdomain`, and the search also matches on it.
create or replace function public.admin_list_organizations(
  p_search text default null,
  p_limit  int  default 50,
  p_offset int  default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_q   text := nullif(btrim(coalesce(p_search, '')), '');
  v_lim int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_off int := greatest(coalesce(p_offset, 0), 0);
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(t))
    from (
      select
        o.id, o.name, o.slug, o.subdomain, o.status, o.created_at,
        s.plan_code,
        (select count(*) from public.organization_members m where m.organization_id = o.id) as users_count,
        (select count(*) from public.creators c where c.organization_id = o.id) as creators_count,
        (select count(*) from public.programs pr where pr.organization_id = o.id) as programs_count,
        (select count(*) from public.shipments sh where sh.organization_id = o.id) as shipments_count
      from public.organizations o
      left join public.organization_subscriptions s on s.organization_id = o.id
      where v_q is null
        or o.name ilike '%' || v_q || '%'
        or o.slug ilike '%' || v_q || '%'
        or o.subdomain ilike '%' || v_q || '%'
      order by o.created_at desc
      limit v_lim offset v_off
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_organizations(text, int, int) from public;
grant execute on function public.admin_list_organizations(text, int, int) to authenticated;
