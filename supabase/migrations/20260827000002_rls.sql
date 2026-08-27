-- Creator Hub — Phase 0 Row Level Security.
--
-- Goal: an authenticated user can only see/act on rows of organizations they
-- are a member of. No cross-tenant reads or writes are possible through the
-- Supabase API (anon / authenticated keys). The `service_role` key and direct
-- SQL (Dashboard SQL editor) bypass RLS by design — that is the operator path.

-- ---------------------------------------------------------------------------
-- Membership helpers.
--
-- SECURITY DEFINER: these run as the function owner (postgres) so that a
-- policy ON organization_members can call a function that SELECTs
-- organization_members without recursing through that same policy — a
-- self-referential policy otherwise raises "infinite recursion detected".
--
-- `set search_path = ''` pins name resolution: every referenced object is
-- fully schema-qualified, so a caller cannot shadow `organization_members`
-- with a temp table / another schema and trick the definer-privileged body.
--
-- STABLE: result does not change within a statement; lets the planner cache it.
-- `(select auth.uid())` is wrapped so it is evaluated once per statement.
-- ---------------------------------------------------------------------------
create or replace function public.is_organization_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_organization_admin(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members m
    where m.organization_id = org_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_organization_member(uuid) from public;
revoke all on function public.is_organization_admin(uuid) from public;
grant execute on function public.is_organization_member(uuid) to authenticated;
grant execute on function public.is_organization_admin(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS. With RLS enabled and no matching policy, access is denied.
-- ---------------------------------------------------------------------------
alter table public.organizations         enable row level security;
alter table public.organization_members  enable row level security;
alter table public.organization_settings enable row level security;

-- ---------------------------------------------------------------------------
-- organizations
--   read   : any member of the org
--   update : owner / admin of the org
--   insert / delete : operator only (no policy -> denied via API)
-- ---------------------------------------------------------------------------
create policy organizations_select_member
  on public.organizations
  for select
  to authenticated
  using (public.is_organization_member(id));

create policy organizations_update_admin
  on public.organizations
  for update
  to authenticated
  using (public.is_organization_admin(id))
  with check (public.is_organization_admin(id));

-- ---------------------------------------------------------------------------
-- organization_members
--   read   : any member sees the roster of their org(s)
--   write  : owner / admin manage members within their org(s)
-- ---------------------------------------------------------------------------
create policy organization_members_select_member
  on public.organization_members
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy organization_members_insert_admin
  on public.organization_members
  for insert
  to authenticated
  with check (public.is_organization_admin(organization_id));

create policy organization_members_update_admin
  on public.organization_members
  for update
  to authenticated
  using (public.is_organization_admin(organization_id))
  with check (public.is_organization_admin(organization_id));

create policy organization_members_delete_admin
  on public.organization_members
  for delete
  to authenticated
  using (public.is_organization_admin(organization_id));

-- ---------------------------------------------------------------------------
-- organization_settings
--   read   : any member
--   update : owner / admin
--   insert : handled by the trigger in the foundation migration (definer)
-- ---------------------------------------------------------------------------
create policy organization_settings_select_member
  on public.organization_settings
  for select
  to authenticated
  using (public.is_organization_member(organization_id));

create policy organization_settings_update_admin
  on public.organization_settings
  for update
  to authenticated
  using (public.is_organization_admin(organization_id))
  with check (public.is_organization_admin(organization_id));
