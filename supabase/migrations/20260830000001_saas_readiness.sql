-- Creator Hub — Phase 6A: SaaS commercial readiness.
--
-- Turns "a system that works for Rare Way" into "a SaaS a platform operator can
-- provision new paying tenants into". NO billing, NO public self-service signup.
-- Adds: platform_admins (a privilege OUTSIDE any tenant), organization
-- commercial metadata, hash-only team invites, a platform audit log, an
-- active/suspended gate on organizations, and the RPCs that drive an /admin
-- area. No earlier migration is edited.

-- ===========================================================================
-- 1. organizations.status — add 'suspended' (operator gate; no billing states)
-- ===========================================================================
alter table public.organizations drop constraint organizations_status_check;
alter table public.organizations add constraint organizations_status_check
  check (status in ('active', 'inactive', 'suspended'));

-- ===========================================================================
-- 2. platform_admins — the Creator Hub operator role. NOT a tenant membership.
-- ===========================================================================
create table public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
-- No policy: readable only through SECURITY DEFINER helpers / direct SQL.

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_admins where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- ===========================================================================
-- 3. organization_subscriptions — commercial condition (plan + dates + notes).
-- The active/suspended gate lives on organizations.status, NOT here, so there
-- is a single source of truth for access.
-- ===========================================================================
create table public.organization_subscriptions (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  plan_code       text not null default 'founding'
                    check (plan_code in ('founding', 'starter', 'pro', 'agency', 'enterprise')),
  started_at      timestamptz not null default now(),
  expires_at      timestamptz,
  notes           text check (notes is null or char_length(notes) <= 2000),
  updated_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger organization_subscriptions_set_updated_at
  before update on public.organization_subscriptions
  for each row execute function public.set_updated_at();

alter table public.organization_subscriptions enable row level security;

create policy organization_subscriptions_select_member
  on public.organization_subscriptions for select to authenticated
  using (public.is_organization_member(organization_id));

-- Every organization gets a subscription row (default plan 'founding' — the
-- first cohort is provisioned by hand as Founding Customers, §11/§63).
create or replace function public.create_organization_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_subscriptions (organization_id)
  values (new.id)
  on conflict (organization_id) do nothing;
  return new;
end;
$$;

create trigger organizations_create_subscription
  after insert on public.organizations
  for each row execute function public.create_organization_subscription();

-- Backfill existing organizations.
insert into public.organization_subscriptions (organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;

-- ===========================================================================
-- 4. organization_invites — hash-only team invites (Phase 4 token discipline).
-- ===========================================================================
create table public.organization_invites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email           text not null check (char_length(email) between 3 and 255),
  role            text not null check (role in ('owner', 'admin', 'analyst')),
  token_hash      text not null,
  status          text not null check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at      timestamptz not null,
  invited_by      uuid references auth.users (id) on delete set null,
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index organization_invites_token_hash_key
  on public.organization_invites (token_hash);
-- At most one live invite per (org, email).
create unique index organization_invites_one_pending_idx
  on public.organization_invites (organization_id, lower(email))
  where status = 'pending';
create index organization_invites_org_created_idx
  on public.organization_invites (organization_id, created_at desc);

create trigger organization_invites_set_updated_at
  before update on public.organization_invites
  for each row execute function public.set_updated_at();

alter table public.organization_invites enable row level security;

-- Owners/admins of the org see its invites. Writes: RPC only.
create policy organization_invites_select_admin
  on public.organization_invites for select to authenticated
  using (public.is_organization_admin(organization_id));

-- ===========================================================================
-- 5. platform_audit_events — operator actions. Separate from creator_events.
-- No PII, no secrets, no raw tokens.
-- ===========================================================================
create table public.platform_audit_events (
  id              uuid primary key default gen_random_uuid(),
  actor_user_id   uuid references auth.users (id) on delete set null,
  organization_id uuid references public.organizations (id) on delete set null,
  event_type      text not null,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index platform_audit_events_created_idx
  on public.platform_audit_events (created_at desc);

alter table public.platform_audit_events enable row level security;
-- No policy: read only through the admin RPC.

-- ===========================================================================
-- 6. Suspension gate — a BEFORE trigger on the panel-write tables. Public
-- submission (submit_application inserting creators/applications) is NOT
-- gated: suspension freezes the *panel*, it does not silently drop inbound
-- leads or delete anything (§31).
-- ===========================================================================
create or replace function public.block_if_org_suspended()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_org uuid := coalesce(new.organization_id, old.organization_id);
begin
  if (select status from public.organizations where id = v_org) = 'suspended' then
    raise exception 'ORGANIZATION_SUSPENDED';
  end if;
  return new;
end;
$$;

create trigger applications_block_suspended
  before update on public.applications
  for each row execute function public.block_if_org_suspended();
create trigger shipments_block_suspended
  before insert or update on public.shipments
  for each row execute function public.block_if_org_suspended();
create trigger shipment_items_block_suspended
  before insert or update on public.shipment_items
  for each row execute function public.block_if_org_suspended();
-- UPDATE only: role changes / demotions are panel ops. INSERT is left open so
-- a suspended org can still be created with `p_status = 'suspended'` and an
-- existing-account owner (the only INSERT path; invites are gated separately).
create trigger organization_members_block_suspended
  before update on public.organization_members
  for each row execute function public.block_if_org_suspended();
create trigger organization_settings_block_suspended
  before update on public.organization_settings
  for each row execute function public.block_if_org_suspended();
create trigger organization_invites_block_suspended
  before insert or update on public.organization_invites
  for each row execute function public.block_if_org_suspended();
create trigger social_metric_snapshots_block_suspended
  before insert or update on public.social_metric_snapshots
  for each row execute function public.block_if_org_suspended();
create trigger application_requests_block_suspended
  before insert or update on public.application_requests
  for each row execute function public.block_if_org_suspended();
create trigger creator_analyses_block_suspended
  before insert or update on public.creator_analyses
  for each row execute function public.block_if_org_suspended();

-- ===========================================================================
-- 7. Platform-admin RPCs. Every one starts with an is_platform_admin() gate.
-- ===========================================================================

-- admin_create_organization: atomic org + settings + subscription (+ owner
-- membership if the e-mail already has an account, else a pending owner invite
-- using the hash the caller minted).
create or replace function public.admin_create_organization(
  p_name           text,
  p_slug           text,
  p_owner_email    text,
  p_plan_code      text,
  p_status         text,
  p_owner_token_hash text
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

  insert into public.organizations (name, slug, status)
  values (v_name, v_slug, v_status)
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
      'owner_pending', (v_owner is null)));

  return jsonb_build_object('ok', true, 'organization_id', v_org,
    'owner_user_id', v_owner, 'owner_invite_pending', (v_owner is null));
end;
$$;

revoke all on function public.admin_create_organization(text, text, text, text, text, text) from public;
grant execute on function public.admin_create_organization(text, text, text, text, text, text) to authenticated;

-- admin_list_organizations: paginated roster with operational counts.
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
        o.id, o.name, o.slug, o.status, o.created_at,
        s.plan_code,
        (select count(*) from public.organization_members m where m.organization_id = o.id) as users_count,
        (select count(*) from public.creators c where c.organization_id = o.id) as creators_count,
        (select count(*) from public.programs pr where pr.organization_id = o.id) as programs_count,
        (select count(*) from public.shipments sh where sh.organization_id = o.id) as shipments_count
      from public.organizations o
      left join public.organization_subscriptions s on s.organization_id = o.id
      where v_q is null or o.name ilike '%' || v_q || '%' or o.slug ilike '%' || v_q || '%'
      order by o.created_at desc
      limit v_lim offset v_off
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_organizations(text, int, int) from public;
grant execute on function public.admin_list_organizations(text, int, int) to authenticated;

-- admin_get_organization: one org's detail (metadata + counts, no tenant PII).
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
    'id', o.id, 'name', o.name, 'slug', o.slug, 'status', o.status,
    'created_at', o.created_at,
    'plan_code', s.plan_code, 'started_at', s.started_at,
    'expires_at', s.expires_at, 'notes', s.notes,
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
  where o.id = p_organization_id;

  if v_row is null then raise exception 'ORGANIZATION_NOT_FOUND'; end if;
  return v_row;
end;
$$;

revoke all on function public.admin_get_organization(uuid) from public;
grant execute on function public.admin_get_organization(uuid) to authenticated;

-- admin_set_organization_status: active <-> suspended.
create or replace function public.admin_set_organization_status(
  p_organization_id uuid, p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_from text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;
  if p_status not in ('active', 'suspended') then raise exception 'INVALID_STATUS'; end if;

  select status into v_from from public.organizations where id = p_organization_id;
  if v_from is null then raise exception 'ORGANIZATION_NOT_FOUND'; end if;

  update public.organizations set status = p_status where id = p_organization_id;

  insert into public.platform_audit_events (actor_user_id, organization_id, event_type, metadata)
  values (v_uid, p_organization_id,
    case when p_status = 'suspended' then 'organization_suspended' else 'organization_reactivated' end,
    jsonb_build_object('from', v_from, 'to', p_status));

  return jsonb_build_object('ok', true, 'from', v_from, 'to', p_status);
end;
$$;

revoke all on function public.admin_set_organization_status(uuid, text) from public;
grant execute on function public.admin_set_organization_status(uuid, text) to authenticated;

-- admin_set_organization_plan: change the commercial condition.
create or replace function public.admin_set_organization_plan(
  p_organization_id uuid, p_plan_code text, p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_from text;
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;
  if p_plan_code not in ('founding', 'starter', 'pro', 'agency', 'enterprise') then
    raise exception 'INVALID_PLAN';
  end if;
  if v_notes is not null and char_length(v_notes) > 2000 then
    raise exception 'INVALID_NOTES';
  end if;

  select plan_code into v_from
  from public.organization_subscriptions where organization_id = p_organization_id;
  if v_from is null then raise exception 'ORGANIZATION_NOT_FOUND'; end if;

  update public.organization_subscriptions set
    plan_code = p_plan_code,
    notes = coalesce(v_notes, notes),
    updated_by = v_uid
  where organization_id = p_organization_id;

  insert into public.platform_audit_events (actor_user_id, organization_id, event_type, metadata)
  values (v_uid, p_organization_id, 'organization_plan_changed',
    jsonb_build_object('from', v_from, 'to', p_plan_code));

  return jsonb_build_object('ok', true, 'from', v_from, 'to', p_plan_code);
end;
$$;

revoke all on function public.admin_set_organization_plan(uuid, text, text) from public;
grant execute on function public.admin_set_organization_plan(uuid, text, text) to authenticated;

-- admin_list_platform_audit
create or replace function public.admin_list_platform_audit(
  p_limit int default 50, p_offset int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_lim int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_off int := greatest(coalesce(p_offset, 0), 0);
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(t))
    from (
      select e.id, e.event_type, e.organization_id, e.metadata, e.created_at,
        (select email from auth.users u where u.id = e.actor_user_id) as actor_email,
        (select name from public.organizations o where o.id = e.organization_id) as organization_name
      from public.platform_audit_events e
      order by e.created_at desc
      limit v_lim offset v_off
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_platform_audit(int, int) from public;
grant execute on function public.admin_list_platform_audit(int, int) to authenticated;

-- ===========================================================================
-- 8. Tenant team RPCs (owner/admin of the org).
-- ===========================================================================

-- create_org_invite
create or replace function public.create_org_invite(
  p_organization_id uuid,
  p_email           text,
  p_role            text,
  p_token_hash      text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id    uuid;
  v_expires timestamptz := now() + interval '14 days';  -- ORG_INVITE_TTL_DAYS
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_admin(p_organization_id) then
    raise exception 'FORBIDDEN';
  end if;
  if p_role not in ('owner', 'admin', 'analyst') then raise exception 'INVALID_ROLE'; end if;
  if v_email = '' or position('@' in v_email) = 0 or char_length(v_email) > 255 then
    raise exception 'INVALID_EMAIL';
  end if;
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    raise exception 'BAD_TOKEN_HASH';
  end if;

  -- sweep an over-due pending invite so the partial unique index won't block.
  update public.organization_invites set status = 'expired', updated_at = now()
  where organization_id = p_organization_id and lower(email) = v_email
    and status = 'pending' and expires_at < now();

  if exists (
    select 1 from public.organization_members m
    join auth.users u on u.id = m.user_id
    where m.organization_id = p_organization_id and lower(u.email) = v_email
  ) then
    raise exception 'ALREADY_MEMBER';
  end if;

  insert into public.organization_invites (
    organization_id, email, role, token_hash, status, expires_at, invited_by
  ) values (
    p_organization_id, v_email, p_role, p_token_hash, 'pending', v_expires, v_uid
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'invite_id', v_id, 'expires_at', v_expires);
end;
$$;

revoke all on function public.create_org_invite(uuid, text, text, text) from public;
grant execute on function public.create_org_invite(uuid, text, text, text) to authenticated;

-- revoke_org_invite
create or replace function public.revoke_org_invite(p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_status text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select organization_id, status into v_org, v_status
  from public.organization_invites where id = p_invite_id;
  if v_org is null then raise exception 'INVITE_NOT_FOUND'; end if;
  if not public.is_organization_admin(v_org) then raise exception 'FORBIDDEN'; end if;

  if v_status = 'pending' then
    update public.organization_invites
    set status = 'revoked', revoked_at = now(), updated_at = now()
    where id = p_invite_id;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.revoke_org_invite(uuid) from public;
grant execute on function public.revoke_org_invite(uuid) to authenticated;

-- get_public_org_invite — anon lookup by token hash. Minimal, no internal data.
create or replace function public.get_public_org_invite(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.organization_invites%rowtype;
  v_org_name text;
begin
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into v_inv from public.organization_invites where token_hash = p_token_hash;
  if not found then return jsonb_build_object('status', 'invalid'); end if;

  if v_inv.status = 'pending' and v_inv.expires_at < now() then
    update public.organization_invites set status = 'expired', updated_at = now()
    where id = v_inv.id;
    v_inv.status := 'expired';
  end if;

  if v_inv.status in ('revoked', 'expired') then
    return jsonb_build_object('status', 'invalid');
  end if;

  select name into v_org_name from public.organizations where id = v_inv.organization_id;

  return jsonb_build_object(
    'status', v_inv.status,          -- 'pending' | 'accepted'
    'organization_name', v_org_name,
    'role', v_inv.role,
    -- Masked: enough to recognise "is this mine?", not a full address leak (§52).
    'email_masked', regexp_replace(v_inv.email, '^(..).*(@.*)$', '\1***\2')
  );
end;
$$;

revoke all on function public.get_public_org_invite(text) from public;
grant execute on function public.get_public_org_invite(text) to anon, authenticated;

-- accept_org_invite — authenticated; the caller's verified e-mail must match.
create or replace function public.accept_org_invite(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_email text;
  v_inv   public.organization_invites%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    raise exception 'INVALID_INVITE';
  end if;

  select * into v_inv from public.organization_invites
  where token_hash = p_token_hash for update;
  if not found then raise exception 'INVALID_INVITE'; end if;

  if v_inv.status = 'pending' and v_inv.expires_at < now() then
    update public.organization_invites set status = 'expired', updated_at = now()
    where id = v_inv.id;
    raise exception 'INVALID_INVITE';
  end if;

  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is null or v_email <> lower(v_inv.email) then
    raise exception 'EMAIL_MISMATCH';
  end if;

  if (select status from public.organizations where id = v_inv.organization_id) = 'suspended' then
    raise exception 'ORGANIZATION_SUSPENDED';
  end if;

  -- Idempotent: already a member (perhaps a retry) -> mark accepted, done.
  if exists (
    select 1 from public.organization_members
    where organization_id = v_inv.organization_id and user_id = v_uid
  ) then
    if v_inv.status = 'pending' then
      update public.organization_invites
      set status = 'accepted', accepted_at = now(), updated_at = now()
      where id = v_inv.id;
    end if;
    return jsonb_build_object('status', 'already_member',
      'organization_id', v_inv.organization_id);
  end if;

  if v_inv.status <> 'pending' then raise exception 'INVALID_INVITE'; end if;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_inv.organization_id, v_uid, v_inv.role);

  update public.organization_invites
  set status = 'accepted', accepted_at = now(), updated_at = now()
  where id = v_inv.id;

  return jsonb_build_object('status', 'accepted',
    'organization_id', v_inv.organization_id);
end;
$$;

revoke all on function public.accept_org_invite(text) from public;
grant execute on function public.accept_org_invite(text) to authenticated;

-- remove_org_member — admin; never the last owner (§22).
create or replace function public.remove_org_member(
  p_organization_id uuid, p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_role text;
  v_owners int;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_admin(p_organization_id) then
    raise exception 'FORBIDDEN';
  end if;

  select role into v_role from public.organization_members
  where organization_id = p_organization_id and user_id = p_user_id;
  if v_role is null then raise exception 'MEMBER_NOT_FOUND'; end if;

  if v_role = 'owner' then
    select count(*) into v_owners from public.organization_members
    where organization_id = p_organization_id and role = 'owner';
    if v_owners <= 1 then raise exception 'LAST_OWNER'; end if;
  end if;

  delete from public.organization_members
  where organization_id = p_organization_id and user_id = p_user_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.remove_org_member(uuid, uuid) from public;
grant execute on function public.remove_org_member(uuid, uuid) to authenticated;

-- set_org_member_role — admin; never demote the last owner (§22).
create or replace function public.set_org_member_role(
  p_organization_id uuid, p_user_id uuid, p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_role text;
  v_owners int;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_admin(p_organization_id) then
    raise exception 'FORBIDDEN';
  end if;
  if p_role not in ('owner', 'admin', 'analyst') then raise exception 'INVALID_ROLE'; end if;

  select role into v_role from public.organization_members
  where organization_id = p_organization_id and user_id = p_user_id;
  if v_role is null then raise exception 'MEMBER_NOT_FOUND'; end if;

  if v_role = 'owner' and p_role <> 'owner' then
    select count(*) into v_owners from public.organization_members
    where organization_id = p_organization_id and role = 'owner';
    if v_owners <= 1 then raise exception 'LAST_OWNER'; end if;
  end if;

  update public.organization_members set role = p_role
  where organization_id = p_organization_id and user_id = p_user_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.set_org_member_role(uuid, uuid, text) from public;
grant execute on function public.set_org_member_role(uuid, uuid, text) to authenticated;

-- list_org_members — roster with e-mails (auth.users not reachable via RLS).
create or replace function public.list_org_members(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_member(p_organization_id) then
    raise exception 'FORBIDDEN';
  end if;

  return jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(row_to_json(t) order by t.created_at)
      from (
        select m.user_id, m.role, m.created_at,
          (select email from auth.users u where u.id = m.user_id) as email
        from public.organization_members m
        where m.organization_id = p_organization_id
      ) t
    ), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(row_to_json(t) order by t.created_at desc)
      from (
        select i.id, i.email, i.role, i.status, i.expires_at, i.created_at
        from public.organization_invites i
        where i.organization_id = p_organization_id
          and i.status in ('pending', 'expired', 'revoked')
      ) t
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.list_org_members(uuid) from public;
grant execute on function public.list_org_members(uuid) to authenticated;
