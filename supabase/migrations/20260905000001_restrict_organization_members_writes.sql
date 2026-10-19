-- Zoviah — SEC-002: organization_members direct-write privilege/invariant bypass.
--
-- Root cause (two parts, confirmed live against a throwaway org+users):
--   1. organization_members_insert_admin / update_admin / delete_admin only
--      checked `is_organization_admin(organization_id)` — the CALLER's status,
--      never the target row. Any admin, hitting PostgREST directly, could
--      set their own role to 'owner', delete any owner, or insert an
--      arbitrary membership.
--   2. The "controlled" RPCs (set_org_member_role, remove_org_member,
--      create_org_invite) had the SAME gap: they only checked
--      is_organization_admin(), never who the TARGET is or whether the
--      caller is specifically an owner. An admin could self-promote or
--      remove a non-last owner through the RPCs too, not just the raw table.
--
-- This migration:
--   A. Drops all three write policies on organization_members. SELECT is
--      untouched. No replacement policy — RLS with zero write policies
--      denies INSERT/UPDATE/DELETE to `authenticated` outright. Every
--      legitimate write already goes through a SECURITY DEFINER RPC (which
--      runs as the table owner and so is unaffected by this), confirmed by
--      grep: no file under src/ does a direct
--      .from("organization_members").insert/update/delete(...).
--   B. Re-creates set_org_member_role / remove_org_member / create_org_invite
--      with the approved governance model:
--        analyst  — no member management (unchanged: excluded by role).
--        admin    — invite/change/remove admin or analyst. Cannot grant
--                   owner, cannot touch a member who currently IS owner
--                   (role change or removal), cannot change their own role.
--        owner    — full management, including granting owner, inviting
--                   owner, changing another owner's role, and removing
--                   another owner. Can never leave the org with zero
--                   owners. Cannot change their OWN role via this RPC either
--                   (CANNOT_CHANGE_OWN_ROLE — approved: self-demotion /
--                   "leave organization" / "transfer ownership" are explicit
--                   future flows, not a side effect of this one).
--      Every authorization decision is derived from a fresh row read of
--      `organization_members` for the CALLER (auth.uid()) inside the
--      function, never from is_organization_admin() alone and never from
--      any client-supplied role.
--   C. Makes the last-owner invariant concurrency-safe: set_org_member_role
--      and remove_org_member now take a tenant-scoped
--      pg_advisory_xact_lock(hashtext('org_members:' || organization_id))
--      before reading caller role / target role / owner count, so two
--      concurrent requests against the same org fully serialize and can
--      never jointly leave it with zero owners. The lock key is scoped to
--      one organization_id — never a global lock.
--
-- No historical migration is edited. Re-runnable (drop policy if exists;
-- create or replace function).

-- ===========================================================================
-- A. Remove direct-write policies. SELECT (organization_members_select_member)
--    is untouched.
-- ===========================================================================
drop policy if exists organization_members_insert_admin on public.organization_members;
drop policy if exists organization_members_update_admin on public.organization_members;
drop policy if exists organization_members_delete_admin on public.organization_members;

-- ===========================================================================
-- B/C. set_org_member_role
-- ===========================================================================
create or replace function public.set_org_member_role(
  p_organization_id uuid, p_user_id uuid, p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := (select auth.uid());
  v_caller_role text;
  v_target_role text;
  v_owners      int;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  -- SEC-002: tenant-scoped serialization. Any two concurrent calls that could
  -- change who is/isn't an owner of this org fully serialize on this lock, so
  -- the LAST_OWNER recount below can never race against a concurrent demotion
  -- or removal in another transaction. Released automatically at the end of
  -- this transaction (pg_advisory_XACT_lock).
  perform pg_advisory_xact_lock(hashtext('org_members:' || p_organization_id::text));

  -- SEC-002: the caller's real role, read fresh (under the lock) from the
  -- table — never trust a role value from the client, and never rely on
  -- is_organization_admin() alone (it only says "admin-or-owner", not which).
  select role into v_caller_role from public.organization_members
  where organization_id = p_organization_id and user_id = v_uid;
  if v_caller_role is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'FORBIDDEN';
  end if;

  if p_role not in ('owner', 'admin', 'analyst') then raise exception 'INVALID_ROLE'; end if;

  -- SEC-002: nobody changes their own role through this path — owner
  -- included. A deliberate self-demotion / "leave organization" / "transfer
  -- ownership" flow, if ever built, is a separate, explicit RPC.
  if p_user_id = v_uid then
    raise exception 'CANNOT_CHANGE_OWN_ROLE';
  end if;

  select role into v_target_role from public.organization_members
  where organization_id = p_organization_id and user_id = p_user_id;
  if v_target_role is null then raise exception 'MEMBER_NOT_FOUND'; end if;

  -- SEC-002: an admin cannot touch an owner's role at all — not demote them
  -- to admin/analyst, not "change" them to anything. Only another owner can.
  if v_target_role = 'owner' and v_caller_role <> 'owner' then
    raise exception 'ONLY_OWNER_CAN_CHANGE_OWNER';
  end if;
  -- SEC-002: only an owner can grant owner to someone who isn't one yet.
  if p_role = 'owner' and v_caller_role <> 'owner' then
    raise exception 'ONLY_OWNER_CAN_GRANT_OWNER';
  end if;

  if v_target_role = 'owner' and p_role <> 'owner' then
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

-- ===========================================================================
-- B/C. remove_org_member
-- ===========================================================================
create or replace function public.remove_org_member(
  p_organization_id uuid, p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := (select auth.uid());
  v_caller_role text;
  v_target_role text;
  v_owners      int;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  -- SEC-002: same tenant-scoped lock as set_org_member_role, same reason.
  perform pg_advisory_xact_lock(hashtext('org_members:' || p_organization_id::text));

  select role into v_caller_role from public.organization_members
  where organization_id = p_organization_id and user_id = v_uid;
  if v_caller_role is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'FORBIDDEN';
  end if;

  -- SEC-002: no self-removal through this path — same "leave organization is
  -- a separate, explicit future flow" reasoning as CANNOT_CHANGE_OWN_ROLE.
  if p_user_id = v_uid then
    raise exception 'CANNOT_REMOVE_SELF';
  end if;

  select role into v_target_role from public.organization_members
  where organization_id = p_organization_id and user_id = p_user_id;
  if v_target_role is null then raise exception 'MEMBER_NOT_FOUND'; end if;

  -- SEC-002: an admin cannot remove an owner — only another owner can, and
  -- only when doing so would not empty the organization of owners (below).
  if v_target_role = 'owner' and v_caller_role <> 'owner' then
    raise exception 'ONLY_OWNER_CAN_REMOVE_OWNER';
  end if;

  if v_target_role = 'owner' then
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

-- ===========================================================================
-- B. create_org_invite — same governance rule for who may be invited as
--    owner. No advisory lock needed: creating an invite never changes an
--    existing owner's standing, so there is no last-owner race to protect.
-- ===========================================================================
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
  v_caller_role text;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_id    uuid;
  v_expires timestamptz := now() + interval '14 days';  -- ORG_INVITE_TTL_DAYS
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select role into v_caller_role from public.organization_members
  where organization_id = p_organization_id and user_id = v_uid;
  if v_caller_role is null or v_caller_role not in ('owner', 'admin') then
    raise exception 'FORBIDDEN';
  end if;

  if p_role not in ('owner', 'admin', 'analyst') then raise exception 'INVALID_ROLE'; end if;
  -- SEC-002: only an owner can invite someone in as owner.
  if p_role = 'owner' and v_caller_role <> 'owner' then
    raise exception 'ONLY_OWNER_CAN_INVITE_OWNER';
  end if;
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
