-- Creator Hub — Phase 2: operational CRM for creators.
--
-- Extends applications with the MVP status machine, adds the actor column to
-- creator_events, adds CRM read/write plumbing (a security-invoker view for the
-- list, count + transition + note RPCs), and the indexes the CRM needs.
--
-- Non-destructive: existing rows are preserved; the only data touch is a
-- targeted, safe cleanup of malformed social handles (trailing "." / "_").

-- ---------------------------------------------------------------------------
-- applications: status machine + approved_at
-- ---------------------------------------------------------------------------
alter table public.applications drop constraint applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in (
    'new', 'awaiting_review', 'information_requested', 'approved', 'archived'
  ));

alter table public.applications add column if not exists approved_at timestamptz;

-- ---------------------------------------------------------------------------
-- creator_events: who did it (nullable — public submission has no actor)
-- ---------------------------------------------------------------------------
alter table public.creator_events
  add column if not exists actor_user_id uuid references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Indexes for the CRM list / filters / timeline
-- ---------------------------------------------------------------------------
create index if not exists applications_org_status_submitted_idx
  on public.applications (organization_id, status, submitted_at desc);
create index if not exists applications_org_program_status_submitted_idx
  on public.applications (organization_id, program_id, status, submitted_at desc);
create index if not exists applications_creator_submitted_idx
  on public.applications (creator_id, submitted_at desc);
create index if not exists creator_events_application_created_idx
  on public.creator_events (application_id, created_at desc);
create index if not exists creators_org_full_name_idx
  on public.creators (organization_id, full_name);

-- Trigram search (PostgreSQL only — no external search engine).
create extension if not exists pg_trgm;
create index if not exists creators_full_name_trgm_idx
  on public.creators using gin (full_name gin_trgm_ops);
create index if not exists creators_email_trgm_idx
  on public.creators using gin (email gin_trgm_ops);
create index if not exists creators_phone_trgm_idx
  on public.creators using gin (phone_e164 gin_trgm_ops);
create index if not exists creator_social_handle_trgm_idx
  on public.creator_social_profiles using gin (handle_normalized gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- One-off cleanup: earlier normalization kept edge "." / "_" on handles
-- (e.g. "@quarteldesign." -> "quarteldesign."). Trim the edges where it does
-- not collide with an existing handle. Never deletes rows.
-- ---------------------------------------------------------------------------
update public.creator_social_profiles s set
  handle_normalized = regexp_replace(s.handle_normalized, '^[._]+|[._]+$', '', 'g'),
  updated_at = now()
where s.handle_normalized ~ '(^[._])|([._]$)'
  and regexp_replace(s.handle_normalized, '^[._]+|[._]+$', '', 'g') <> ''
  and not exists (
    select 1 from public.creator_social_profiles s2
    where s2.organization_id = s.organization_id
      and s2.platform = s.platform
      and s2.id <> s.id
      and s2.handle_normalized = regexp_replace(s.handle_normalized, '^[._]+|[._]+$', '', 'g')
  );

-- ---------------------------------------------------------------------------
-- application_list_items — flattened CRM list row.
--
-- security_invoker = true  ->  the view runs with the CALLER's privileges, so
-- RLS on applications / programs / creators / creator_social_profiles is
-- enforced. Without it a view owned by postgres would bypass RLS and leak
-- across tenants.
-- ---------------------------------------------------------------------------
create view public.application_list_items
with (security_invoker = true) as
select
  a.id,
  a.organization_id,
  a.program_id,
  a.creator_id,
  a.status,
  a.possible_duplicate,
  a.submitted_at,
  a.created_at,
  p.name                  as program_name,
  c.full_name             as creator_name,
  c.preferred_name        as creator_preferred_name,
  c.email                 as creator_email,
  c.phone_e164            as creator_phone,
  c.city                  as creator_city,
  c.state                 as creator_state,
  ig.handle               as instagram_handle,
  ig.handle_normalized    as instagram_handle_normalized,
  ig.profile_url          as instagram_url,
  ig.followers_declared   as instagram_followers,
  tt.handle               as tiktok_handle,
  tt.handle_normalized    as tiktok_handle_normalized,
  tt.profile_url          as tiktok_url,
  tt.followers_declared   as tiktok_followers
from public.applications a
join public.programs p on p.id = a.program_id
join public.creators c on c.id = a.creator_id
left join lateral (
  select s.* from public.creator_social_profiles s
  where s.creator_id = a.creator_id and s.platform = 'instagram'
  order by s.followers_declared desc nulls last, s.created_at asc
  limit 1
) ig on true
left join lateral (
  select s.* from public.creator_social_profiles s
  where s.creator_id = a.creator_id and s.platform = 'tiktok'
  order by s.followers_declared desc nulls last, s.created_at asc
  limit 1
) tt on true;

grant select on public.application_list_items to authenticated;

-- ---------------------------------------------------------------------------
-- crm_counts — operational counters for the CRM header.
-- SECURITY INVOKER (default): RLS on applications limits the count to the
-- caller's organization. `p_program_id` is just an extra filter.
-- ---------------------------------------------------------------------------
create or replace function public.crm_counts(p_program_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'total_active',          count(*) filter (where status <> 'archived'),
    'new',                   count(*) filter (where status = 'new'),
    'awaiting_review',       count(*) filter (where status = 'awaiting_review'),
    'information_requested', count(*) filter (where status = 'information_requested'),
    'approved',              count(*) filter (where status = 'approved'),
    'archived',              count(*) filter (where status = 'archived'),
    'possible_duplicate',    count(*) filter (where possible_duplicate)
  )
  from public.applications
  where (p_program_id is null or program_id = p_program_id);
$$;

grant execute on function public.crm_counts(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- is_valid_application_transition — the single source of truth for the state
-- machine, callable from SQL and mirrored (and tested) in TypeScript.
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_application_transition(
  p_from text, p_to text
)
returns boolean
language sql
immutable
as $$
  select (p_from, p_to) in (
    ('new', 'awaiting_review'),
    ('new', 'approved'),
    ('new', 'information_requested'),
    ('new', 'archived'),
    ('awaiting_review', 'approved'),
    ('awaiting_review', 'information_requested'),
    ('awaiting_review', 'archived'),
    ('information_requested', 'awaiting_review'),
    ('information_requested', 'approved'),
    ('information_requested', 'archived'),
    ('approved', 'archived'),
    ('archived', 'awaiting_review')
  );
$$;

grant execute on function public.is_valid_application_transition(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- transition_application_status — the ONLY way status changes.
--
-- SECURITY DEFINER so *any member* of the owning org can operate (Phase 1
-- policies only let owner/admin UPDATE applications directly; §34 wants
-- analysts to operate too). It re-derives the org from the application row —
-- never trusts a client-supplied org — checks membership, validates the
-- transition, updates the row and writes the audit event, atomically.
-- ---------------------------------------------------------------------------
create or replace function public.transition_application_status(
  p_application_id uuid,
  p_to_status      text,
  p_note           text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_org     uuid;
  v_creator uuid;
  v_from    text;
  v_email   text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select organization_id, creator_id, status
    into v_org, v_creator, v_from
  from public.applications
  where id = p_application_id;

  if v_org is null then
    raise exception 'APPLICATION_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org and user_id = v_uid
  ) then
    raise exception 'FORBIDDEN';
  end if;

  if not public.is_valid_application_transition(v_from, p_to_status) then
    raise exception 'INVALID_TRANSITION: % -> %', v_from, p_to_status;
  end if;

  select email into v_email from auth.users where id = v_uid;

  update public.applications set
    status      = p_to_status,
    approved_at = case when p_to_status = 'approved' then now() else approved_at end,
    archived_at = case
                    when p_to_status = 'archived' then now()
                    when v_from = 'archived' then null
                    else archived_at
                  end
  where id = p_application_id;

  insert into public.creator_events
    (organization_id, creator_id, application_id, type, actor_user_id, data)
  values (
    v_org, v_creator, p_application_id, 'application_status_changed', v_uid,
    jsonb_build_object('from', v_from, 'to', p_to_status, 'actor_email', v_email)
  );

  if p_note is not null and length(btrim(p_note)) > 0 then
    insert into public.creator_events
      (organization_id, creator_id, application_id, type, actor_user_id, data)
    values (
      v_org, v_creator, p_application_id, 'note_added', v_uid,
      jsonb_build_object('text', left(btrim(p_note), 4000), 'actor_email', v_email)
    );
  end if;

  return jsonb_build_object('ok', true, 'from', v_from, 'to', p_to_status);
end;
$$;

revoke all on function public.transition_application_status(uuid, text, text) from public;
grant execute on function public.transition_application_status(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- add_creator_note — internal note on a creator (§8). Uses creator_events
-- (type = note_added); no new table. Same membership check.
-- ---------------------------------------------------------------------------
create or replace function public.add_creator_note(
  p_creator_id     uuid,
  p_text           text,
  p_application_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_org   uuid;
  v_email text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_text is null or length(btrim(p_text)) = 0 then
    raise exception 'EMPTY_NOTE';
  end if;

  select organization_id into v_org from public.creators where id = p_creator_id;
  if v_org is null then
    raise exception 'CREATOR_NOT_FOUND';
  end if;

  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org and user_id = v_uid
  ) then
    raise exception 'FORBIDDEN';
  end if;

  if p_application_id is not null and not exists (
    select 1 from public.applications
    where id = p_application_id
      and organization_id = v_org
      and creator_id = p_creator_id
  ) then
    raise exception 'APPLICATION_MISMATCH';
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into public.creator_events
    (organization_id, creator_id, application_id, type, actor_user_id, data)
  values (
    v_org, p_creator_id, p_application_id, 'note_added', v_uid,
    jsonb_build_object('text', left(btrim(p_text), 4000), 'actor_email', v_email)
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.add_creator_note(uuid, text, uuid) from public;
grant execute on function public.add_creator_note(uuid, text, uuid) to authenticated;
