-- Zoviah — bootstrap the first organization and its owner.
--
-- WHY THIS EXISTS
--   RLS blocks creating an organization or the first membership through the
--   API (there is no INSERT policy on `organizations`, and adding a member
--   requires already being an admin). The first owner therefore has to be
--   created by an operator. This script is that operator action.
--
-- HOW TO RUN
--   1. Create the user in Supabase Auth first:
--        Dashboard -> Authentication -> Users -> "Add user"
--        (or send an invite). Use a real address; do not invent credentials.
--   2. Open Dashboard -> SQL Editor (it runs as `postgres` and bypasses RLS).
--   3. Replace the email below and run this whole script.
--
-- Safe to run more than once: it upserts the org by slug and the membership
-- by (organization_id, user_id).

do $$
declare
  v_email   text := 'REPLACE_WITH_USER_EMAIL';
  v_user_id uuid;
  v_org_id  uuid;
begin
  select id into v_user_id from auth.users where email = v_email;
  if v_user_id is null then
    raise exception
      'No auth user with email %. Create the user in Supabase Auth first.', v_email;
  end if;

  insert into public.organizations (name, slug, status)
  values ('Rare Way', 'rare-way', 'active')
  on conflict (slug) do update set name = excluded.name
  returning id into v_org_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_org_id, v_user_id, 'owner')
  on conflict (organization_id, user_id) do update set role = 'owner';

  raise notice 'Bootstrapped organization % (owner user %)', v_org_id, v_user_id;
end
$$;
