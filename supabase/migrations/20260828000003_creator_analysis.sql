-- Creator Hub — Phase 3A: creator analysis (intelligence engine).
--
-- Three layers, kept separate on purpose:
--   evidence (sanitized payload)  ->  criteria (deterministic + qualitative)
--   ->  deterministic score engine (in application code, not SQL, not the model)
--
-- This migration adds the storage + the write path. The score is NEVER
-- computed here and NEVER by the model — the RPC just persists what the app's
-- pure score-engine produced.
--
-- No migration edited. RLS: members read; only the SECURITY DEFINER RPCs write.

-- ---------------------------------------------------------------------------
-- creator_analyses — one row per analysis run (history is append-only).
-- ---------------------------------------------------------------------------
create table public.creator_analyses (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  creator_id       uuid not null references public.creators (id) on delete cascade,
  application_id   uuid not null references public.applications (id) on delete cascade,

  status           text not null default 'processing'
                     check (status in ('processing', 'completed', 'failed')),

  provider         text not null,
  model            text,
  prompt_version   text not null,
  scoring_version  text not null,

  score            integer check (score is null or (score between 0 and 100)),
  tier             text    check (tier is null or tier in ('A', 'B', 'C', 'D')),
  confidence       text    check (confidence is null or confidence in ('low', 'medium', 'high')),
  evidence_coverage numeric(4, 3)
                     check (evidence_coverage is null or (evidence_coverage between 0 and 1)),

  subscores        jsonb not null default '{}'::jsonb,
  summary          text,
  strengths        jsonb,
  attention_points jsonb,
  suggested_tags   jsonb,

  input_snapshot   jsonb,   -- the SANITIZED payload sent to the model (audit)
  raw_result       jsonb,   -- the model's parsed output (audit)

  input_tokens     integer,
  output_tokens    integer,
  latency_ms       integer,

  error_code       text,
  error_message    text,

  started_at       timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz not null default now()
);

create index creator_analyses_application_created_idx
  on public.creator_analyses (application_id, created_at desc);
create index creator_analyses_org_status_created_idx
  on public.creator_analyses (organization_id, status, created_at desc);

-- At most one analysis "processing" per application (§23 concurrency guard).
create unique index creator_analyses_one_processing_per_application_idx
  on public.creator_analyses (application_id)
  where status = 'processing';

alter table public.creator_analyses enable row level security;

create policy creator_analyses_select_member
  on public.creator_analyses for select to authenticated
  using (public.is_organization_member(organization_id));
-- No insert/update/delete policy: only start/complete/fail RPCs write.

-- ---------------------------------------------------------------------------
-- applications — denormalized cache so the CRM list never queries analyses.
-- History stays in creator_analyses; these are intentional cache columns.
-- ---------------------------------------------------------------------------
alter table public.applications
  add column current_analysis_id  uuid references public.creator_analyses (id) on delete set null,
  add column current_score        integer check (current_score is null or (current_score between 0 and 100)),
  add column current_tier         text    check (current_tier is null or current_tier in ('A', 'B', 'C', 'D')),
  add column analysis_status      text not null default 'not_analyzed'
                                    check (analysis_status in ('not_analyzed', 'processing', 'completed', 'failed')),
  add column analysis_confidence  text check (analysis_confidence is null or analysis_confidence in ('low', 'medium', 'high')),
  add column analysis_coverage    numeric(4, 3) check (analysis_coverage is null or (analysis_coverage between 0 and 1));

create index applications_org_tier_idx
  on public.applications (organization_id, current_tier);
create index applications_org_score_idx
  on public.applications (organization_id, current_score desc nulls last);
create index applications_org_analysis_status_idx
  on public.applications (organization_id, analysis_status);

-- ---------------------------------------------------------------------------
-- application_list_items — re-create with the analysis cache columns appended.
-- (security_invoker = true still enforces RLS of the base tables.)
-- ---------------------------------------------------------------------------
create or replace view public.application_list_items
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
  tt.followers_declared   as tiktok_followers,
  a.current_score         as current_score,
  a.current_tier          as current_tier,
  a.analysis_status       as analysis_status,
  a.analysis_confidence   as analysis_confidence,
  a.analysis_coverage     as analysis_coverage
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
-- start_creator_analysis — reserve a processing slot.
--
-- SECURITY DEFINER: any member of the owning org may trigger an analysis.
-- Derives org/creator/program from the application row (never from the client).
-- Auto-fails a stale 'processing' row (>10 min) so a crashed run cannot wedge
-- the unique index forever.
-- ---------------------------------------------------------------------------
create or replace function public.start_creator_analysis(
  p_application_id  uuid,
  p_provider        text,
  p_model           text,
  p_prompt_version  text,
  p_scoring_version text
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
  v_program uuid;
  v_id      uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select organization_id, creator_id, program_id
    into v_org, v_creator, v_program
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

  -- Release a wedged run before checking the guard.
  update public.creator_analyses
     set status = 'failed',
         error_code = 'stale_timeout',
         error_message = 'Análise anterior não finalizou.',
         completed_at = now()
   where application_id = p_application_id
     and status = 'processing'
     and started_at < now() - interval '10 minutes';

  begin
    insert into public.creator_analyses (
      organization_id, creator_id, application_id,
      status, provider, model, prompt_version, scoring_version, started_at
    ) values (
      v_org, v_creator, p_application_id,
      'processing', p_provider, nullif(p_model, ''), p_prompt_version, p_scoring_version, now()
    )
    returning id into v_id;
  exception when unique_violation then
    raise exception 'ANALYSIS_IN_PROGRESS';
  end;

  update public.applications
     set analysis_status = 'processing'
   where id = p_application_id;

  return jsonb_build_object(
    'analysis_id', v_id,
    'organization_id', v_org,
    'creator_id', v_creator,
    'program_id', v_program
  );
end;
$$;

revoke all on function public.start_creator_analysis(uuid, text, text, text, text) from public;
grant execute on function public.start_creator_analysis(uuid, text, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- complete_creator_analysis — persist the finished analysis + update the cache
-- atomically, and log one timeline event. The score/tier/confidence/coverage
-- in p_result come from the app's deterministic engine — this function does
-- not compute them.
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
-- fail_creator_analysis — mark the run failed. Does NOT touch current_score /
-- current_tier / current_analysis_id — the last completed analysis stays.
-- ---------------------------------------------------------------------------
create or replace function public.fail_creator_analysis(
  p_analysis_id   uuid,
  p_error_code    text,
  p_error_message text
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
    return jsonb_build_object('ok', true, 'noop', true);
  end if;

  update public.creator_analyses set
    status        = 'failed',
    error_code    = left(coalesce(p_error_code, 'unknown'), 60),
    error_message = left(coalesce(p_error_message, ''), 400),
    completed_at  = now()
  where id = p_analysis_id;

  update public.applications set analysis_status = 'failed'
  where id = v_application;

  insert into public.creator_events
    (organization_id, creator_id, application_id, type, actor_user_id, data)
  values (
    v_org, v_creator, v_application, 'analysis_failed', v_uid,
    jsonb_build_object('analysis_id', p_analysis_id, 'error_code', left(coalesce(p_error_code, 'unknown'), 60))
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.fail_creator_analysis(uuid, text, text) from public;
grant execute on function public.fail_creator_analysis(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- analysis_stats — small counters for /app/ai. SECURITY INVOKER: RLS scopes
-- it to the caller's organization.
-- ---------------------------------------------------------------------------
create or replace function public.analysis_stats()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'completed',    count(*) filter (where status = 'completed'),
    'failed',       count(*) filter (where status = 'failed'),
    'processing',   count(*) filter (where status = 'processing'),
    'avg_score',    round(avg(score) filter (where status = 'completed' and score is not null)),
    'avg_coverage', round(avg(evidence_coverage) filter (where status = 'completed' and evidence_coverage is not null), 3)
  )
  from public.creator_analyses;
$$;

grant execute on function public.analysis_stats() to authenticated;
