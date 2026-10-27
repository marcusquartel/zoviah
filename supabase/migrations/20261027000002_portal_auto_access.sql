-- Portal access without invites: every approved creator can use the portal
-- with the e-mail on her record. An account whose CONFIRMED e-mail equals a
-- creator's e-mail (approved application, not archived) is linked to her on
-- first use. Staff can still turn access off per creator (portal_disabled),
-- which the automatic link respects; a new invite turns it back on.

alter table public.creators
  add column if not exists portal_disabled boolean not null default false;

-- Link the signed-in account to every eligible creator with its e-mail.
-- Internal: called by portal_my_creators().
create or replace function public.portal_claim_creators(p_user uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_count int;
begin
  select lower(btrim(email)) into v_email
  from auth.users
  where id = p_user and email_confirmed_at is not null;
  if v_email is null or v_email = '' then return 0; end if;

  insert into public.creator_portal_users (creator_id, user_id, organization_id)
  select c.id, p_user, c.organization_id
  from public.creators c
  where lower(btrim(c.email)) = v_email
    and c.archived_at is null
    and not c.portal_disabled
    and exists (select 1 from public.applications a
                where a.creator_id = c.id and a.status = 'approved')
  on conflict (creator_id) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.portal_claim_creators(uuid) from public, anon, authenticated;

create or replace function public.portal_my_creators()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then return '[]'::jsonb; end if;
  perform public.portal_claim_creators(v_uid);
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'creator_id', c.id,
      'creator_name', coalesce(nullif(btrim(c.preferred_name), ''), c.full_name),
      'organization_name', o.name
    ) order by o.name), '[]'::jsonb)
    from public.creator_portal_users pu
    join public.creators c on c.id = pu.creator_id and c.archived_at is null
    join public.organizations o on o.id = pu.organization_id and o.status <> 'suspended'
    where pu.user_id = v_uid
  );
end;
$$;
revoke all on function public.portal_my_creators() from public;
grant execute on function public.portal_my_creators() to authenticated;

-- Removing access now also blocks the automatic link.
create or replace function public.revoke_creator_portal_access(p_creator_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_org uuid;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select organization_id into v_org from public.creators where id = p_creator_id;
  if v_org is null then raise exception 'CREATOR_NOT_FOUND'; end if;
  if not public.is_organization_admin(v_org) then raise exception 'FORBIDDEN'; end if;
  delete from public.creator_portal_users where creator_id = p_creator_id;
  update public.creator_portal_invites set status = 'revoked', updated_at = now()
  where creator_id = p_creator_id and status = 'pending';
  update public.creators set portal_disabled = true where id = p_creator_id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.revoke_creator_portal_access(uuid) from public;
grant execute on function public.revoke_creator_portal_access(uuid) to authenticated;

-- A fresh invite re-enables access.
create or replace function public.creators_portal_reenable_on_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.creators set portal_disabled = false
  where id = new.creator_id and portal_disabled;
  return new;
end;
$$;
revoke all on function public.creators_portal_reenable_on_invite() from public, anon, authenticated;

drop trigger if exists creator_portal_invites_reenable on public.creator_portal_invites;
create trigger creator_portal_invites_reenable
  after insert on public.creator_portal_invites
  for each row execute function public.creators_portal_reenable_on_invite();
