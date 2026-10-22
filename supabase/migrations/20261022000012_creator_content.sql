-- Zoviah — creator content log (stage 1: manual).
--
-- A creator registers each publication that features the brand from her
-- portal (link and/or a screenshot — stories vanish in 24h, so a print is the
-- proof); staff approve or reject it in the CRM, or register one themselves
-- (auto-approved). Approved items are what the brand counts.
-- Later stages (Meta mentions / creator-connected accounts) will write into
-- the same table with another `source`.
--
-- Screenshots live in a PRIVATE bucket "creator-content" at
-- <creator_id>/<file>, readable by the brand's members and by the creator.

create table public.creator_content (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  creator_id       uuid not null references public.creators (id) on delete cascade,
  platform         text not null check (platform in ('instagram', 'tiktok')),
  format           text not null check (format in ('post', 'reel', 'story', 'video')),
  url              text check (url is null or char_length(url) <= 500),
  screenshot_path  text check (screenshot_path is null or char_length(screenshot_path) <= 300),
  posted_on        date not null,
  note             text check (note is null or char_length(note) <= 500),
  status           text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  source           text not null check (source in ('creator', 'staff')),
  review_note      text check (review_note is null or char_length(review_note) <= 300),
  reviewed_by      uuid references auth.users (id) on delete set null,
  reviewed_at      timestamptz,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  constraint creator_content_proof check (url is not null or screenshot_path is not null)
);

create index creator_content_org_status_idx on public.creator_content (organization_id, status, created_at desc);
create index creator_content_creator_idx on public.creator_content (creator_id, posted_on desc);
-- The same link can't be registered twice for a creator.
create unique index creator_content_creator_url_key
  on public.creator_content (creator_id, lower(url)) where url is not null;

alter table public.creator_content enable row level security;
create policy creator_content_select_member
  on public.creator_content for select to authenticated
  using (public.is_organization_member(organization_id));
-- Writes only through the RPCs below.

-- ===========================================================================
-- Storage: private screenshots
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('creator-content', 'creator-content', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Read: members of the creator's org, or the creator herself.
create or replace function public.can_read_creator_file(p_name text)
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
        public.is_organization_member(c.organization_id)
        or exists (
          select 1 from public.creator_portal_users pu
          where pu.creator_id = c.id and pu.user_id = (select auth.uid())
        )
      )
  );
$$;
revoke all on function public.can_read_creator_file(text) from public, anon;
grant execute on function public.can_read_creator_file(text) to authenticated;

drop policy if exists "creator-content read" on storage.objects;
create policy "creator-content read"
  on storage.objects for select to authenticated
  using (bucket_id = 'creator-content' and public.can_read_creator_file(name));

-- Write: same rule as the avatar (org owner/admin, or the creator).
drop policy if exists "creator-content write" on storage.objects;
create policy "creator-content write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'creator-content' and public.can_write_creator_avatar(name));

drop policy if exists "creator-content delete" on storage.objects;
create policy "creator-content delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'creator-content' and public.can_write_creator_avatar(name));

-- ===========================================================================
-- Shared validation
-- ===========================================================================
create or replace function public.validate_creator_content(p_creator_id uuid, p jsonb)
returns void
language plpgsql
stable
set search_path = ''
as $$
declare
  v_url  text := nullif(btrim(coalesce(p->>'url', '')), '');
  v_shot text := nullif(btrim(coalesce(p->>'screenshot_path', '')), '');
begin
  if p is null or jsonb_typeof(p) <> 'object' or octet_length(p::text) > 3000 then
    raise exception 'INVALID_PAYLOAD';
  end if;
  if coalesce(p->>'platform', '') not in ('instagram', 'tiktok') then raise exception 'INVALID_PLATFORM'; end if;
  if coalesce(p->>'format', '') not in ('post', 'reel', 'story', 'video') then raise exception 'INVALID_FORMAT'; end if;
  if p->>'platform' = 'tiktok' and p->>'format' in ('post', 'reel') then raise exception 'INVALID_FORMAT'; end if;
  if p->>'platform' = 'instagram' and p->>'format' = 'video' then raise exception 'INVALID_FORMAT'; end if;
  if v_url is null and v_shot is null then raise exception 'PROOF_REQUIRED'; end if;
  if v_url is not null and (
       char_length(v_url) > 500
       or (p->>'platform' = 'instagram' and v_url !~* '^https://(www\.)?instagram\.com/')
       or (p->>'platform' = 'tiktok' and v_url !~* '^https://(www\.|vm\.|vt\.|m\.)?tiktok\.com/')
     ) then
    raise exception 'INVALID_URL';
  end if;
  if v_shot is not null and v_shot !~ ('^' || p_creator_id::text || '/[A-Za-z0-9._-]{1,120}$') then
    raise exception 'INVALID_SCREENSHOT';
  end if;
  if nullif(p->>'posted_on', '') is null or p->>'posted_on' !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'INVALID_DATE';
  end if;
  if (p->>'posted_on')::date > current_date + 1 or (p->>'posted_on')::date < current_date - 400 then
    raise exception 'INVALID_DATE';
  end if;
  if char_length(coalesce(p->>'note', '')) > 500 then raise exception 'INVALID_PAYLOAD'; end if;
end;
$$;
revoke all on function public.validate_creator_content(uuid, jsonb) from public, anon, authenticated;

create or replace function public.insert_creator_content(
  p_org uuid, p_creator_id uuid, p jsonb, p_source text, p_status text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid; v_uid uuid := (select auth.uid());
begin
  begin
    insert into public.creator_content (
      organization_id, creator_id, platform, format, url, screenshot_path,
      posted_on, note, status, source, created_by, reviewed_by, reviewed_at
    ) values (
      p_org, p_creator_id, p->>'platform', p->>'format',
      nullif(btrim(coalesce(p->>'url', '')), ''),
      nullif(btrim(coalesce(p->>'screenshot_path', '')), ''),
      (p->>'posted_on')::date,
      nullif(btrim(coalesce(p->>'note', '')), ''),
      p_status, p_source, v_uid,
      case when p_status = 'approved' then v_uid end,
      case when p_status = 'approved' then now() end
    ) returning id into v_id;
  exception when unique_violation then
    raise exception 'DUPLICATE_URL';
  end;
  return v_id;
end;
$$;
revoke all on function public.insert_creator_content(uuid, uuid, jsonb, text, text) from public, anon, authenticated;

-- ===========================================================================
-- Creator (portal)
-- ===========================================================================
create or replace function public.portal_submit_content(p_creator_id uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_org uuid; v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select pu.organization_id into v_org from public.creator_portal_users pu
  where pu.creator_id = p_creator_id and pu.user_id = (select auth.uid());
  if v_org is null then raise exception 'FORBIDDEN'; end if;
  perform public.validate_creator_content(p_creator_id, p);
  v_id := public.insert_creator_content(v_org, p_creator_id, p, 'creator', 'pending');
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
revoke all on function public.portal_submit_content(uuid, jsonb) from public;
grant execute on function public.portal_submit_content(uuid, jsonb) to authenticated;

-- Her content list + month counts. Same doors as the dashboard: the creator
-- herself, or an owner/admin previewing.
create or replace function public.portal_content(p_creator_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org   uuid;
  v_month date := (date_trunc('month', now() at time zone 'America/Sao_Paulo'))::date;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select organization_id into v_org from public.creators where id = p_creator_id;
  if v_org is null or not (
    exists (select 1 from public.creator_portal_users where creator_id = p_creator_id and user_id = (select auth.uid()))
    or public.is_organization_admin(v_org)
  ) then
    raise exception 'FORBIDDEN';
  end if;

  return jsonb_build_object(
    'month', (
      select jsonb_build_object(
        'approved', count(*) filter (where status = 'approved'),
        'pending', count(*) filter (where status = 'pending'),
        'stories', count(*) filter (where status = 'approved' and format = 'story'),
        'feed', count(*) filter (where status = 'approved' and format <> 'story'))
      from public.creator_content where creator_id = p_creator_id and posted_on >= v_month),
    'total_approved', (
      select count(*) from public.creator_content where creator_id = p_creator_id and status = 'approved'),
    'items', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'platform', platform, 'format', format, 'url', url,
        'screenshot_path', screenshot_path, 'posted_on', posted_on, 'note', note,
        'status', status, 'review_note', review_note) order by posted_on desc, created_at desc), '[]'::jsonb)
      from (select * from public.creator_content where creator_id = p_creator_id
            order by posted_on desc, created_at desc limit 30) x)
  );
end;
$$;
revoke all on function public.portal_content(uuid) from public;
grant execute on function public.portal_content(uuid) to authenticated;

-- ===========================================================================
-- Staff
-- ===========================================================================
create or replace function public.staff_add_content(p_creator_id uuid, p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_org uuid; v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select organization_id into v_org from public.creators where id = p_creator_id;
  if v_org is null then raise exception 'CREATOR_NOT_FOUND'; end if;
  if not public.is_organization_admin(v_org) then raise exception 'FORBIDDEN'; end if;
  perform public.validate_creator_content(p_creator_id, p);
  v_id := public.insert_creator_content(v_org, p_creator_id, p, 'staff', 'approved');
  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;
revoke all on function public.staff_add_content(uuid, jsonb) from public;
grant execute on function public.staff_add_content(uuid, jsonb) to authenticated;

create or replace function public.review_creator_content(p_id uuid, p_status text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_org uuid;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_status not in ('approved', 'rejected', 'pending') then raise exception 'INVALID_STATUS'; end if;
  select organization_id into v_org from public.creator_content where id = p_id;
  if v_org is null then raise exception 'CONTENT_NOT_FOUND'; end if;
  if not public.is_organization_admin(v_org) then raise exception 'FORBIDDEN'; end if;
  update public.creator_content set
    status      = p_status,
    review_note = case when p_status = 'rejected' then left(nullif(btrim(coalesce(p_note, '')), ''), 300) end,
    reviewed_by = case when p_status = 'pending' then null else (select auth.uid()) end,
    reviewed_at = case when p_status = 'pending' then null else now() end
  where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.review_creator_content(uuid, text, text) from public;
grant execute on function public.review_creator_content(uuid, text, text) to authenticated;

create or replace function public.delete_creator_content(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare r public.creator_content%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into r from public.creator_content where id = p_id;
  if r.id is null then raise exception 'CONTENT_NOT_FOUND'; end if;
  -- Staff (admin) may delete any; the creator only her own still-pending item.
  if not (
    public.is_organization_admin(r.organization_id)
    or (r.status = 'pending' and exists (
          select 1 from public.creator_portal_users
          where creator_id = r.creator_id and user_id = (select auth.uid())))
  ) then
    raise exception 'FORBIDDEN';
  end if;
  delete from public.creator_content where id = p_id;
  return jsonb_build_object('ok', true, 'screenshot_path', r.screenshot_path);
end;
$$;
revoke all on function public.delete_creator_content(uuid) from public;
grant execute on function public.delete_creator_content(uuid) to authenticated;
