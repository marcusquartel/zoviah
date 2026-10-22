-- Zoviah — creator avatar path is <creator_id>/<file> (the organization is
-- derived from the creator), so the portal never needs the org id.
-- No object was stored under the previous <org>/<creator>/ layout.

create or replace function public.can_write_creator_avatar(p_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.creators c
    where c.id::text = (storage.foldername(p_name))[1]
      and (
        public.is_organization_admin(c.organization_id)
        or exists (
          select 1 from public.creator_portal_users pu
          where pu.creator_id = c.id and pu.user_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function public.set_creator_avatar(p_creator_id uuid, p_url text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from public.creators where id = p_creator_id) then
    raise exception 'CREATOR_NOT_FOUND';
  end if;
  if not public.can_write_creator_avatar(p_creator_id::text || '/x') then
    raise exception 'FORBIDDEN';
  end if;
  if v_url is not null and (
       char_length(v_url) > 500
       or position('/storage/v1/object/public/creator-avatars/' || p_creator_id::text || '/' in v_url) = 0
     ) then
    raise exception 'INVALID_URL';
  end if;
  update public.creators set avatar_url = v_url, updated_at = now() where id = p_creator_id;
  return jsonb_build_object('ok', true);
end;
$$;
