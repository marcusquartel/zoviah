-- Creator Hub — Phase 1 Row Level Security.
--
-- Same model as Phase 0: authenticated users only touch rows of organizations
-- they belong to, enforced by `public.is_organization_member()` /
-- `public.is_organization_admin()`. With RLS enabled and no matching policy,
-- access is denied.
--
-- Public form traffic never goes through these policies: it uses the
-- SECURITY DEFINER RPCs in 20260827000005_public_submission.sql, which are the
-- only privileged path and are scoped to a single program.

alter table public.programs                enable row level security;
alter table public.form_fields             enable row level security;
alter table public.creators                enable row level security;
alter table public.creator_social_profiles enable row level security;
alter table public.applications            enable row level security;
alter table public.creator_events          enable row level security;

-- ---------------------------------------------------------------------------
-- programs  — members read; owner/admin manage
-- ---------------------------------------------------------------------------
create policy programs_select_member
  on public.programs for select to authenticated
  using (public.is_organization_member(organization_id));

create policy programs_insert_admin
  on public.programs for insert to authenticated
  with check (public.is_organization_admin(organization_id));

create policy programs_update_admin
  on public.programs for update to authenticated
  using (public.is_organization_admin(organization_id))
  with check (public.is_organization_admin(organization_id));

create policy programs_delete_admin
  on public.programs for delete to authenticated
  using (public.is_organization_admin(organization_id));

-- ---------------------------------------------------------------------------
-- form_fields  — members read; owner/admin manage
-- ---------------------------------------------------------------------------
create policy form_fields_select_member
  on public.form_fields for select to authenticated
  using (public.is_organization_member(organization_id));

create policy form_fields_insert_admin
  on public.form_fields for insert to authenticated
  with check (public.is_organization_admin(organization_id));

create policy form_fields_update_admin
  on public.form_fields for update to authenticated
  using (public.is_organization_admin(organization_id))
  with check (public.is_organization_admin(organization_id));

create policy form_fields_delete_admin
  on public.form_fields for delete to authenticated
  using (public.is_organization_admin(organization_id));

-- ---------------------------------------------------------------------------
-- creators  — members read; owner/admin edit manually (public path = RPC)
-- ---------------------------------------------------------------------------
create policy creators_select_member
  on public.creators for select to authenticated
  using (public.is_organization_member(organization_id));

create policy creators_insert_admin
  on public.creators for insert to authenticated
  with check (public.is_organization_admin(organization_id));

create policy creators_update_admin
  on public.creators for update to authenticated
  using (public.is_organization_admin(organization_id))
  with check (public.is_organization_admin(organization_id));

create policy creators_delete_admin
  on public.creators for delete to authenticated
  using (public.is_organization_admin(organization_id));

-- ---------------------------------------------------------------------------
-- creator_social_profiles  — members read; owner/admin edit manually
-- ---------------------------------------------------------------------------
create policy creator_social_profiles_select_member
  on public.creator_social_profiles for select to authenticated
  using (public.is_organization_member(organization_id));

create policy creator_social_profiles_insert_admin
  on public.creator_social_profiles for insert to authenticated
  with check (public.is_organization_admin(organization_id));

create policy creator_social_profiles_update_admin
  on public.creator_social_profiles for update to authenticated
  using (public.is_organization_admin(organization_id))
  with check (public.is_organization_admin(organization_id));

create policy creator_social_profiles_delete_admin
  on public.creator_social_profiles for delete to authenticated
  using (public.is_organization_admin(organization_id));

-- ---------------------------------------------------------------------------
-- applications  — members read; owner/admin update/delete.
-- No INSERT policy: new applications only arrive through submit_application().
-- ---------------------------------------------------------------------------
create policy applications_select_member
  on public.applications for select to authenticated
  using (public.is_organization_member(organization_id));

create policy applications_update_admin
  on public.applications for update to authenticated
  using (public.is_organization_admin(organization_id))
  with check (public.is_organization_admin(organization_id));

create policy applications_delete_admin
  on public.applications for delete to authenticated
  using (public.is_organization_admin(organization_id));

-- ---------------------------------------------------------------------------
-- creator_events  — members read only. Written solely by the definer RPC.
-- ---------------------------------------------------------------------------
create policy creator_events_select_member
  on public.creator_events for select to authenticated
  using (public.is_organization_member(organization_id));
