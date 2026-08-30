-- Creator Hub — Phase 6B (2/2): product feedback.
--
-- Feature requests + organization-level voting + a public roadmap + a
-- changelog ("Novidades"). Split from the support migration per §73 because
-- support and product feedback are independent concerns. No earlier migration
-- is edited.
--
-- §37: one official vote per ORGANIZATION (not per user) — twenty seats at the
--   same company must not inflate a request. Enforced by unique
--   (organization_id, request_id); the row also records which user cast it.
-- §39: the roadmap never carries a date or a promised deadline.
-- §49: only PUBLISHED roadmap items / changelog entries are visible to a
--   tenant; drafts are platform-admin only, via RPC.

-- ===========================================================================
-- 1. feature_requests — tenant-authored, cross-tenant visible once triaged.
-- ===========================================================================
create table public.feature_requests (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references public.organizations (id) on delete cascade,
  created_by           uuid references auth.users (id) on delete set null,
  title                text not null check (char_length(title) between 1 and 160),
  problem              text not null check (char_length(problem) between 1 and 4000),
  use_case             text check (use_case is null or char_length(use_case) <= 4000),
  frequency            text not null default 'sometimes'
                         check (frequency in ('rarely', 'sometimes', 'often', 'daily')),
  importance           text not null default 'important'
                         check (importance in ('nice_to_have', 'important', 'essential')),
  status               text not null default 'submitted'
                         check (status in ('submitted', 'under_review', 'planned',
                                           'in_progress', 'released', 'declined')),
  -- When several requests are the same ask, the platform admin points the
  -- duplicates at one canonical row; votes then aggregate on the canonical.
  canonical_request_id uuid references public.feature_requests (id) on delete set null,
  admin_note           text check (admin_note is null or char_length(admin_note) <= 4000),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index feature_requests_status_idx on public.feature_requests (status, created_at desc);
create index feature_requests_org_idx on public.feature_requests (organization_id, created_at desc);
create index feature_requests_canonical_idx
  on public.feature_requests (canonical_request_id)
  where canonical_request_id is not null;

create trigger feature_requests_set_updated_at
  before update on public.feature_requests
  for each row execute function public.set_updated_at();

alter table public.feature_requests enable row level security;

-- A tenant sees its own requests plus any request that has been triaged
-- (status past 'submitted') — that is the shared board. Raw 'submitted' rows
-- from other tenants stay private until an admin reviews them.
create policy feature_requests_select
  on public.feature_requests for select to authenticated
  using (
    public.is_organization_member(organization_id)
    or status <> 'submitted'
  );

create policy feature_requests_insert_own
  on public.feature_requests for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and public.is_organization_member(organization_id)
  );

-- ===========================================================================
-- 2. feature_request_votes — one row per (organization, request).
-- ===========================================================================
create table public.feature_request_votes (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references public.feature_requests (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (organization_id, request_id)
);

create index feature_request_votes_request_idx
  on public.feature_request_votes (request_id);

alter table public.feature_request_votes enable row level security;

-- A tenant sees only its own vote rows; aggregate counts come from an RPC.
create policy feature_request_votes_select_own
  on public.feature_request_votes for select to authenticated
  using (public.is_organization_member(organization_id));

-- ===========================================================================
-- 3. roadmap_items — platform-authored; §39 no dates.
-- ===========================================================================
create table public.roadmap_items (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null check (char_length(title) between 1 and 160),
  summary            text check (summary is null or char_length(summary) <= 2000),
  status             text not null default 'under_consideration'
                       check (status in ('under_consideration', 'planned',
                                         'in_progress', 'released')),
  sort_order         integer not null default 0,
  feature_request_id uuid references public.feature_requests (id) on delete set null,
  published          boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index roadmap_items_public_idx
  on public.roadmap_items (published, status, sort_order);

create trigger roadmap_items_set_updated_at
  before update on public.roadmap_items
  for each row execute function public.set_updated_at();

alter table public.roadmap_items enable row level security;

create policy roadmap_items_select_published
  on public.roadmap_items for select to authenticated
  using (published = true);

-- ===========================================================================
-- 4. changelog_entries — "Novidades".
-- ===========================================================================
create table public.changelog_entries (
  id                     uuid primary key default gen_random_uuid(),
  title                  text not null check (char_length(title) between 1 and 200),
  summary                text check (summary is null or char_length(summary) <= 1000),
  content                text not null,
  status                 text not null default 'draft'
                           check (status in ('draft', 'published')),
  published_at           timestamptz,
  related_roadmap_item_id uuid references public.roadmap_items (id) on delete set null,
  created_by             uuid references auth.users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index changelog_entries_published_idx
  on public.changelog_entries (status, published_at desc);

create trigger changelog_entries_set_updated_at
  before update on public.changelog_entries
  for each row execute function public.set_updated_at();

alter table public.changelog_entries enable row level security;

create policy changelog_entries_select_published
  on public.changelog_entries for select to authenticated
  using (status = 'published');

-- ===========================================================================
-- 5. Tenant-facing RPCs.
-- ===========================================================================

-- list_feature_requests — the shared board, with per-org vote counts and
-- whether the caller's organization has voted. Canonical rows aggregate the
-- votes of their duplicates.
create or replace function public.list_feature_requests(
  p_organization_id uuid, p_status text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_member(p_organization_id) then
    raise exception 'FORBIDDEN';
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(t))
    from (
      select
        fr.id, fr.title, fr.problem, fr.use_case, fr.frequency, fr.importance,
        fr.status, fr.created_at,
        public.is_organization_member(fr.organization_id) as is_own,
        (
          select count(distinct v.organization_id)
          from public.feature_request_votes v
          where v.request_id = fr.id
             or v.request_id in (
               select d.id from public.feature_requests d
               where d.canonical_request_id = fr.id
             )
        ) as vote_count,
        exists (
          select 1 from public.feature_request_votes v
          where v.organization_id = p_organization_id
            and (v.request_id = fr.id or v.request_id in (
              select d.id from public.feature_requests d
              where d.canonical_request_id = fr.id
            ))
        ) as voted
      from public.feature_requests fr
      where fr.canonical_request_id is null
        and (
          public.is_organization_member(fr.organization_id)
          or fr.status <> 'submitted'
        )
        and (p_status is null or fr.status = p_status)
      order by vote_count desc, fr.created_at desc
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_feature_requests(uuid, text) from public;
grant execute on function public.list_feature_requests(uuid, text) to authenticated;

-- submit_feature_request
create or replace function public.submit_feature_request(
  p_organization_id uuid,
  p_title text,
  p_problem text,
  p_use_case text,
  p_frequency text,
  p_importance text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_problem text := btrim(coalesce(p_problem, ''));
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_member(p_organization_id) then raise exception 'FORBIDDEN'; end if;
  if v_title = '' or char_length(v_title) > 160 then raise exception 'INVALID_TITLE'; end if;
  if v_problem = '' or char_length(v_problem) > 4000 then raise exception 'INVALID_PROBLEM'; end if;
  if coalesce(p_frequency, 'sometimes') not in ('rarely', 'sometimes', 'often', 'daily') then
    raise exception 'INVALID_FREQUENCY';
  end if;
  if coalesce(p_importance, 'important') not in ('nice_to_have', 'important', 'essential') then
    raise exception 'INVALID_IMPORTANCE';
  end if;

  insert into public.feature_requests
    (organization_id, created_by, title, problem, use_case, frequency, importance)
  values (
    p_organization_id, v_uid, v_title, v_problem,
    nullif(btrim(coalesce(p_use_case, '')), ''),
    coalesce(p_frequency, 'sometimes'), coalesce(p_importance, 'important')
  )
  returning id into v_id;

  -- The submitting organization implicitly backs its own request.
  insert into public.feature_request_votes (request_id, organization_id, user_id)
  values (v_id, p_organization_id, v_uid)
  on conflict (organization_id, request_id) do nothing;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.submit_feature_request(uuid, text, text, text, text, text) from public;
grant execute on function public.submit_feature_request(uuid, text, text, text, text, text) to authenticated;

-- vote_feature_request — toggles the caller organization's single vote.
create or replace function public.vote_feature_request(
  p_organization_id uuid, p_request_id uuid, p_vote boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_target uuid;
  v_canonical uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_member(p_organization_id) then raise exception 'FORBIDDEN'; end if;

  select id, canonical_request_id into v_target, v_canonical
  from public.feature_requests where id = p_request_id;
  if v_target is null then raise exception 'REQUEST_NOT_FOUND'; end if;
  -- Votes always land on the canonical row when the request is a duplicate.
  v_target := coalesce(v_canonical, v_target);

  if p_vote then
    insert into public.feature_request_votes (request_id, organization_id, user_id)
    values (v_target, p_organization_id, v_uid)
    on conflict (organization_id, request_id) do nothing;
  else
    delete from public.feature_request_votes
    where request_id = v_target and organization_id = p_organization_id;
  end if;

  return jsonb_build_object('ok', true, 'vote_count', (
    select count(*) from public.feature_request_votes where request_id = v_target
  ));
end;
$$;

revoke all on function public.vote_feature_request(uuid, uuid, boolean) from public;
grant execute on function public.vote_feature_request(uuid, uuid, boolean) to authenticated;

-- get_roadmap — published items only, grouped by status; §39 no dates.
create or replace function public.get_roadmap()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select id, title, summary, status, sort_order
    from public.roadmap_items
    where published = true
    order by
      case status
        when 'in_progress' then 0 when 'planned' then 1
        when 'under_consideration' then 2 else 3 end,
      sort_order, updated_at desc
  ) t;
$$;

grant execute on function public.get_roadmap() to authenticated;

-- get_changelog — published entries, newest first.
create or replace function public.get_changelog(p_limit int default 30)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select id, title, summary, content, published_at, related_roadmap_item_id
    from public.changelog_entries
    where status = 'published'
    order by published_at desc nulls last
    limit least(greatest(coalesce(p_limit, 30), 1), 100)
  ) t;
$$;

grant execute on function public.get_changelog(int) to authenticated;

-- ===========================================================================
-- 6. Platform-admin RPCs.
-- ===========================================================================

create or replace function public.admin_list_feature_requests(p_status text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(t))
    from (
      select
        fr.id, fr.title, fr.problem, fr.use_case, fr.frequency, fr.importance,
        fr.status, fr.admin_note, fr.canonical_request_id, fr.created_at,
        o.name as organization_name,
        (
          select count(distinct v.organization_id)
          from public.feature_request_votes v
          where v.request_id = fr.id or v.request_id in (
            select d.id from public.feature_requests d where d.canonical_request_id = fr.id
          )
        ) as vote_count
      from public.feature_requests fr
      join public.organizations o on o.id = fr.organization_id
      where p_status is null or fr.status = p_status
      order by vote_count desc, fr.created_at desc
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_feature_requests(text) from public;
grant execute on function public.admin_list_feature_requests(text) to authenticated;

create or replace function public.admin_update_feature_request(
  p_request_id uuid,
  p_status text default null,
  p_canonical_request_id uuid default null,
  p_admin_note text default null,
  p_clear_canonical boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.feature_requests where id = p_request_id) then
    raise exception 'REQUEST_NOT_FOUND';
  end if;
  if p_status is not null and p_status not in
     ('submitted', 'under_review', 'planned', 'in_progress', 'released', 'declined') then
    raise exception 'INVALID_STATUS';
  end if;
  if p_canonical_request_id is not null then
    if p_canonical_request_id = p_request_id then raise exception 'INVALID_CANONICAL'; end if;
    if not exists (select 1 from public.feature_requests where id = p_canonical_request_id) then
      raise exception 'CANONICAL_NOT_FOUND';
    end if;
  end if;

  update public.feature_requests set
    status = coalesce(p_status, status),
    canonical_request_id = case
      when p_clear_canonical then null
      when p_canonical_request_id is not null then p_canonical_request_id
      else canonical_request_id end,
    admin_note = case when p_admin_note is null then admin_note else left(p_admin_note, 4000) end
  where id = p_request_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_update_feature_request(uuid, text, uuid, text, boolean) from public;
grant execute on function public.admin_update_feature_request(uuid, text, uuid, text, boolean) to authenticated;

create or replace function public.admin_upsert_roadmap_item(
  p_id uuid,
  p_title text,
  p_summary text,
  p_status text,
  p_sort_order int,
  p_feature_request_id uuid,
  p_published boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;
  if v_title = '' or char_length(v_title) > 160 then raise exception 'INVALID_TITLE'; end if;
  if coalesce(p_status, 'under_consideration') not in
     ('under_consideration', 'planned', 'in_progress', 'released') then
    raise exception 'INVALID_STATUS';
  end if;

  if p_id is null then
    insert into public.roadmap_items
      (title, summary, status, sort_order, feature_request_id, published)
    values (
      v_title, nullif(btrim(coalesce(p_summary, '')), ''),
      coalesce(p_status, 'under_consideration'), coalesce(p_sort_order, 0),
      p_feature_request_id, coalesce(p_published, false)
    )
    returning id into v_id;
  else
    update public.roadmap_items set
      title = v_title, summary = nullif(btrim(coalesce(p_summary, '')), ''),
      status = coalesce(p_status, status), sort_order = coalesce(p_sort_order, sort_order),
      feature_request_id = p_feature_request_id, published = coalesce(p_published, published)
    where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'ITEM_NOT_FOUND'; end if;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.admin_upsert_roadmap_item(uuid, text, text, text, int, uuid, boolean) from public;
grant execute on function public.admin_upsert_roadmap_item(uuid, text, text, text, int, uuid, boolean) to authenticated;

create or replace function public.admin_list_roadmap_items()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t))
    from (
      select id, title, summary, status, sort_order, feature_request_id,
        published, updated_at
      from public.roadmap_items
      order by sort_order, updated_at desc
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_roadmap_items() from public;
grant execute on function public.admin_list_roadmap_items() to authenticated;

create or replace function public.admin_upsert_changelog_entry(
  p_id uuid,
  p_title text,
  p_summary text,
  p_content text,
  p_status text,
  p_related_roadmap_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
  v_content text := btrim(coalesce(p_content, ''));
  v_status text := coalesce(p_status, 'draft');
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;
  if v_title = '' or char_length(v_title) > 200 then raise exception 'INVALID_TITLE'; end if;
  if v_content = '' then raise exception 'INVALID_CONTENT'; end if;
  if v_status not in ('draft', 'published') then raise exception 'INVALID_STATUS'; end if;

  if p_id is null then
    insert into public.changelog_entries
      (title, summary, content, status, published_at, related_roadmap_item_id, created_by)
    values (
      v_title, nullif(btrim(coalesce(p_summary, '')), ''), v_content, v_status,
      case when v_status = 'published' then now() else null end,
      p_related_roadmap_item_id, v_uid
    )
    returning id into v_id;
  else
    update public.changelog_entries set
      title = v_title, summary = nullif(btrim(coalesce(p_summary, '')), ''),
      content = v_content, status = v_status,
      published_at = case
        when v_status = 'published' and published_at is null then now()
        when v_status = 'draft' then null
        else published_at end,
      related_roadmap_item_id = p_related_roadmap_item_id
    where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'ENTRY_NOT_FOUND'; end if;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.admin_upsert_changelog_entry(uuid, text, text, text, text, uuid) from public;
grant execute on function public.admin_upsert_changelog_entry(uuid, text, text, text, text, uuid) to authenticated;

create or replace function public.admin_list_changelog_entries()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t))
    from (
      select id, title, summary, content, status, published_at,
        related_roadmap_item_id, updated_at
      from public.changelog_entries
      order by coalesce(published_at, updated_at) desc
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_changelog_entries() from public;
grant execute on function public.admin_list_changelog_entries() to authenticated;
