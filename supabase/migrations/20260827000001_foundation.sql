-- Creator Hub — Phase 0 foundation schema (multi-tenant).
--
-- Tenancy boundary: `organization_id`. Every future table that holds tenant
-- data must carry `organization_id` and an RLS policy built on
-- `public.is_organization_member()` (see 20260827000002_rls.sql).

-- gen_random_uuid(). Present by default on Supabase, guarded for local/self-host.
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Shared trigger: keep `updated_at` current on UPDATE.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null,
  status     text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_slug_key unique (slug),
  constraint organizations_status_check check (status in ('active', 'inactive')),
  constraint organizations_slug_format_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- organization_members
-- ---------------------------------------------------------------------------
create table public.organization_members (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  role            text not null,
  created_at      timestamptz not null default now(),
  constraint organization_members_role_check
    check (role in ('owner', 'admin', 'analyst')),
  -- A user appears at most once per organization.
  constraint organization_members_org_user_key unique (organization_id, user_id)
);

create index organization_members_organization_id_idx
  on public.organization_members (organization_id);
create index organization_members_user_id_idx
  on public.organization_members (user_id);

-- ---------------------------------------------------------------------------
-- organization_settings (white label — one row per organization)
-- ---------------------------------------------------------------------------
create table public.organization_settings (
  organization_id uuid primary key
    references public.organizations (id) on delete cascade,
  logo_url        text,
  favicon_url     text,
  primary_color   text,
  secondary_color text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger organization_settings_set_updated_at
  before update on public.organization_settings
  for each row execute function public.set_updated_at();

-- Guarantee a settings row exists for every organization.
create or replace function public.create_organization_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.organization_settings (organization_id)
  values (new.id)
  on conflict (organization_id) do nothing;
  return new;
end;
$$;

create trigger organizations_create_settings
  after insert on public.organizations
  for each row execute function public.create_organization_settings();
