-- Creator Hub — Phase 3B: Evidence Layer (social metric snapshots).
--
-- This phase ONLY collects evidence. It does NOT change the score:
-- `creator-score-v1` and `objective.ts` are untouched — performance /
-- consistency / community_quality / growth_potential still return null. The
-- data gathered here is the dataset for a future `creator-score-v2` calibration
-- (its own phase). No migration edited.
--
-- Median / average from a views sample are computed in SQL here (and in the
-- pure module for the UI preview) — never trusted from the browser.

-- ---------------------------------------------------------------------------
-- social_metric_snapshots — one observation of a social profile at a point in
-- time. `platform` is NOT duplicated: derive it via social_profile_id (§9).
-- ---------------------------------------------------------------------------
create table public.social_metric_snapshots (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  creator_id        uuid not null references public.creators (id) on delete cascade,
  social_profile_id uuid not null references public.creator_social_profiles (id) on delete cascade,

  source            text not null
                      check (source in ('declared', 'admin_manual', 'creator_provided', 'import', 'api')),
  observed_at       timestamptz not null default now(),
  period_days       integer check (period_days is null or (period_days between 1 and 365)),

  followers         bigint  check (followers is null or followers >= 0),
  average_views     bigint  check (average_views is null or average_views >= 0),
  median_views      bigint  check (median_views is null or median_views >= 0),
  views_sample      jsonb,  -- [int, int, ...] recent view counts (1..30)

  average_likes     numeric check (average_likes is null or average_likes >= 0),
  average_comments  numeric check (average_comments is null or average_comments >= 0),
  average_shares    numeric check (average_shares is null or average_shares >= 0),
  average_saves     numeric check (average_saves is null or average_saves >= 0),

  reach             bigint  check (reach is null or reach >= 0),
  interactions      bigint  check (interactions is null or interactions >= 0),
  posts_count       integer check (posts_count is null or posts_count >= 0),

  notes             text,
  created_by        uuid references auth.users (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- At least one metric must be present — no empty snapshots (§39).
  constraint social_metric_snapshots_has_metric check (
    followers is not null or average_views is not null or median_views is not null
    or views_sample is not null or average_likes is not null
    or average_comments is not null or average_shares is not null
    or average_saves is not null or reach is not null
    or interactions is not null or posts_count is not null
  )
);

create index social_metric_snapshots_profile_observed_idx
  on public.social_metric_snapshots (social_profile_id, observed_at desc, created_at desc);
create index social_metric_snapshots_org_created_idx
  on public.social_metric_snapshots (organization_id, created_at desc);

create trigger social_metric_snapshots_set_updated_at
  before update on public.social_metric_snapshots
  for each row execute function public.set_updated_at();

alter table public.social_metric_snapshots enable row level security;

-- Members read; writes go through the SECURITY DEFINER RPCs only (§26).
create policy social_metric_snapshots_select_member
  on public.social_metric_snapshots for select to authenticated
  using (public.is_organization_member(organization_id));

-- ---------------------------------------------------------------------------
-- latest_metric_snapshots — newest snapshot per social profile.
-- security_invoker: RLS of the base table applies.
-- ---------------------------------------------------------------------------
create view public.latest_metric_snapshots
with (security_invoker = true) as
select distinct on (social_profile_id) *
from public.social_metric_snapshots
order by social_profile_id, observed_at desc, created_at desc;

grant select on public.latest_metric_snapshots to authenticated;

-- ---------------------------------------------------------------------------
-- creator_analyses.used_snapshot_ids — which snapshots an analysis consumed
-- (§49). New column on an existing table (not editing the old migration).
-- ---------------------------------------------------------------------------
alter table public.creator_analyses
  add column used_snapshot_ids uuid[] not null default '{}';

-- ---------------------------------------------------------------------------
-- median from a jsonb int array (§11): odd -> middle, even -> mean of the two
-- middle values (percentile_cont interpolates: [10,20,30,40] -> 25).
-- ---------------------------------------------------------------------------
create or replace function public.jsonb_int_median(p_arr jsonb)
returns numeric
language sql
immutable
as $$
  select percentile_cont(0.5) within group (order by (v)::numeric)
  from jsonb_array_elements_text(coalesce(p_arr, '[]'::jsonb)) v
  where v ~ '^-?[0-9]+(\.[0-9]+)?$';
$$;

create or replace function public.jsonb_int_avg(p_arr jsonb)
returns numeric
language sql
immutable
as $$
  select avg((v)::numeric)
  from jsonb_array_elements_text(coalesce(p_arr, '[]'::jsonb)) v
  where v ~ '^-?[0-9]+(\.[0-9]+)?$';
$$;

-- ---------------------------------------------------------------------------
-- create_metric_snapshot — SECURITY DEFINER. Derives org + creator from the
-- social profile (never trusts client-supplied ids, §58). Any member may
-- create. Recomputes median/average from views_sample in SQL. Writes one
-- timeline event.
-- ---------------------------------------------------------------------------
create or replace function public.create_metric_snapshot(
  p_social_profile_id uuid,
  p_payload           jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_org       uuid;
  v_creator   uuid;
  v_platform  text;
  v_sample    jsonb := p_payload->'views_sample';
  v_observed  timestamptz := coalesce(nullif(p_payload->>'observed_at', '')::timestamptz, now());
  v_median    bigint;
  v_avg       bigint;
  v_id        uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select p.organization_id, p.creator_id, p.platform
    into v_org, v_creator, v_platform
  from public.creator_social_profiles p
  where p.id = p_social_profile_id;

  if v_org is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org and user_id = v_uid
  ) then
    raise exception 'FORBIDDEN';
  end if;
  if v_observed > now() + interval '1 day' then
    raise exception 'OBSERVED_AT_FUTURE';
  end if;
  if v_sample is not null and jsonb_typeof(v_sample) = 'array'
     and jsonb_array_length(v_sample) > 30 then
    raise exception 'SAMPLE_TOO_LARGE';
  end if;

  if v_sample is not null and jsonb_typeof(v_sample) = 'array'
     and jsonb_array_length(v_sample) >= 1 then
    v_median := round(public.jsonb_int_median(v_sample));
    v_avg := round(public.jsonb_int_avg(v_sample));
  else
    v_sample := null;
    v_median := nullif(p_payload->>'median_views', '')::bigint;
    v_avg := nullif(p_payload->>'average_views', '')::bigint;
  end if;

  insert into public.social_metric_snapshots (
    organization_id, creator_id, social_profile_id,
    source, observed_at, period_days,
    followers, average_views, median_views, views_sample,
    average_likes, average_comments, average_shares, average_saves,
    reach, interactions, posts_count, notes, created_by
  ) values (
    v_org, v_creator, p_social_profile_id,
    coalesce(nullif(p_payload->>'source', ''), 'admin_manual'),
    v_observed,
    nullif(p_payload->>'period_days', '')::int,
    nullif(p_payload->>'followers', '')::bigint,
    v_avg, v_median, v_sample,
    nullif(p_payload->>'average_likes', '')::numeric,
    nullif(p_payload->>'average_comments', '')::numeric,
    nullif(p_payload->>'average_shares', '')::numeric,
    nullif(p_payload->>'average_saves', '')::numeric,
    nullif(p_payload->>'reach', '')::bigint,
    nullif(p_payload->>'interactions', '')::bigint,
    nullif(p_payload->>'posts_count', '')::int,
    left(nullif(btrim(p_payload->>'notes'), ''), 500),
    v_uid
  )
  returning id into v_id;

  insert into public.creator_events
    (organization_id, creator_id, application_id, type, actor_user_id, data)
  values (
    v_org, v_creator, null, 'metric_snapshot_added', v_uid,
    jsonb_build_object(
      'snapshot_id', v_id, 'social_profile_id', p_social_profile_id,
      'platform', v_platform, 'source', coalesce(nullif(p_payload->>'source', ''), 'admin_manual'),
      'observed_at', v_observed
    )
  );

  return jsonb_build_object('ok', true, 'snapshot_id', v_id,
    'median_views', v_median, 'average_views', v_avg);
end;
$$;

revoke all on function public.create_metric_snapshot(uuid, jsonb) from public;
grant execute on function public.create_metric_snapshot(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- update_metric_snapshot — correct a mistyped snapshot (§27). Re-derives org
-- from the snapshot row, recomputes median/average if views_sample changed,
-- logs metric_snapshot_updated.
-- ---------------------------------------------------------------------------
create or replace function public.update_metric_snapshot(
  p_snapshot_id uuid,
  p_payload     jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_org      uuid;
  v_creator  uuid;
  v_profile  uuid;
  v_platform text;
  v_sample   jsonb := p_payload->'views_sample';
  v_observed timestamptz := coalesce(nullif(p_payload->>'observed_at', '')::timestamptz, now());
  v_median   bigint;
  v_avg      bigint;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select s.organization_id, s.creator_id, s.social_profile_id
    into v_org, v_creator, v_profile
  from public.social_metric_snapshots s
  where s.id = p_snapshot_id;

  if v_org is null then
    raise exception 'SNAPSHOT_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org and user_id = v_uid
  ) then
    raise exception 'FORBIDDEN';
  end if;
  if v_observed > now() + interval '1 day' then
    raise exception 'OBSERVED_AT_FUTURE';
  end if;
  if v_sample is not null and jsonb_typeof(v_sample) = 'array'
     and jsonb_array_length(v_sample) > 30 then
    raise exception 'SAMPLE_TOO_LARGE';
  end if;

  select p.platform into v_platform
  from public.creator_social_profiles p where p.id = v_profile;

  if v_sample is not null and jsonb_typeof(v_sample) = 'array'
     and jsonb_array_length(v_sample) >= 1 then
    v_median := round(public.jsonb_int_median(v_sample));
    v_avg := round(public.jsonb_int_avg(v_sample));
  else
    v_sample := null;
    v_median := nullif(p_payload->>'median_views', '')::bigint;
    v_avg := nullif(p_payload->>'average_views', '')::bigint;
  end if;

  update public.social_metric_snapshots set
    source           = coalesce(nullif(p_payload->>'source', ''), source),
    observed_at      = v_observed,
    period_days      = nullif(p_payload->>'period_days', '')::int,
    followers        = nullif(p_payload->>'followers', '')::bigint,
    average_views    = v_avg,
    median_views     = v_median,
    views_sample     = v_sample,
    average_likes    = nullif(p_payload->>'average_likes', '')::numeric,
    average_comments = nullif(p_payload->>'average_comments', '')::numeric,
    average_shares   = nullif(p_payload->>'average_shares', '')::numeric,
    average_saves    = nullif(p_payload->>'average_saves', '')::numeric,
    reach            = nullif(p_payload->>'reach', '')::bigint,
    interactions     = nullif(p_payload->>'interactions', '')::bigint,
    posts_count      = nullif(p_payload->>'posts_count', '')::int,
    notes            = left(nullif(btrim(p_payload->>'notes'), ''), 500)
  where id = p_snapshot_id;

  insert into public.creator_events
    (organization_id, creator_id, application_id, type, actor_user_id, data)
  values (
    v_org, v_creator, null, 'metric_snapshot_updated', v_uid,
    jsonb_build_object(
      'snapshot_id', p_snapshot_id, 'social_profile_id', v_profile,
      'platform', v_platform, 'observed_at', v_observed
    )
  );

  return jsonb_build_object('ok', true, 'snapshot_id', p_snapshot_id,
    'median_views', v_median, 'average_views', v_avg);
end;
$$;

revoke all on function public.update_metric_snapshot(uuid, jsonb) from public;
grant execute on function public.update_metric_snapshot(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- complete_creator_analysis — re-created to also persist used_snapshot_ids
-- from p_result (signature unchanged). Everything else identical to
-- 20260828000003.
-- ---------------------------------------------------------------------------
create or replace function public.complete_creator_analysis(
  p_analysis_id uuid,
  p_result      jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_org uuid;
  v_creator uuid;
  v_application uuid;
  v_status text;
  v_score int := nullif(p_result->>'score', '')::int;
  v_tier text := nullif(p_result->>'tier', '');
  v_conf text := nullif(p_result->>'confidence', '');
  v_cov numeric := nullif(p_result->>'evidence_coverage', '')::numeric;
  v_snaps uuid[] := coalesce(
    (select array_agg(x::uuid)
     from jsonb_array_elements_text(coalesce(p_result->'used_snapshot_ids', '[]'::jsonb)) x),
    '{}'
  );
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select organization_id, creator_id, application_id, status
    into v_org, v_creator, v_application, v_status
  from public.creator_analyses
  where id = p_analysis_id;

  if v_org is null then
    raise exception 'ANALYSIS_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org and user_id = v_uid
  ) then
    raise exception 'FORBIDDEN';
  end if;
  if v_status <> 'processing' then
    raise exception 'ANALYSIS_NOT_PROCESSING';
  end if;

  update public.creator_analyses set
    status           = 'completed',
    model            = coalesce(nullif(p_result->>'model', ''), model),
    score            = v_score,
    tier             = v_tier,
    confidence       = v_conf,
    evidence_coverage = v_cov,
    subscores        = coalesce(p_result->'subscores', '{}'::jsonb),
    summary          = nullif(p_result->>'summary', ''),
    strengths        = p_result->'strengths',
    attention_points = p_result->'attention_points',
    suggested_tags   = p_result->'suggested_tags',
    input_snapshot   = p_result->'input_snapshot',
    raw_result       = p_result->'raw_result',
    used_snapshot_ids = v_snaps,
    input_tokens     = nullif(p_result->>'input_tokens', '')::int,
    output_tokens    = nullif(p_result->>'output_tokens', '')::int,
    latency_ms       = nullif(p_result->>'latency_ms', '')::int,
    completed_at     = now()
  where id = p_analysis_id;

  update public.applications set
    current_analysis_id = p_analysis_id,
    current_score       = v_score,
    current_tier        = v_tier,
    analysis_status     = 'completed',
    analysis_confidence = v_conf,
    analysis_coverage   = v_cov
  where id = v_application;

  insert into public.creator_events
    (organization_id, creator_id, application_id, type, actor_user_id, data)
  values (
    v_org, v_creator, v_application, 'analysis_completed', v_uid,
    jsonb_build_object('analysis_id', p_analysis_id, 'score', v_score, 'tier', v_tier)
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.complete_creator_analysis(uuid, jsonb) from public;
grant execute on function public.complete_creator_analysis(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- evidence_stats — small counters for /app/ai (§70). security invoker.
-- ---------------------------------------------------------------------------
create or replace function public.evidence_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'snapshots', (select count(*) from public.social_metric_snapshots),
    'creators_with_snapshot',
      (select count(distinct creator_id) from public.social_metric_snapshots),
    'profiles_multi_snapshot',
      (select count(*) from (
        select social_profile_id
        from public.social_metric_snapshots
        group by social_profile_id
        having count(*) >= 2
      ) t)
  );
$$;

grant execute on function public.evidence_stats() to authenticated;
