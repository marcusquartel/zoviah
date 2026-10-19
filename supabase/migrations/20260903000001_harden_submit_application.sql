-- Zoviah — SEC-003: harden the public application-submission RPC.
--
-- `submit_application` is granted to `anon` and the anon key is public, so
-- `POST /rest/v1/rpc/submit_application` is reachable by anyone, bypassing the
-- Next.js wrapper that today holds the honeypot check, Zod validation and the
-- per-IP rate limit. The org / program / status were already safe (derived from
-- real rows inside the RPC — no client-supplied organization_id / program_id /
-- status), but payload size and submission rate were unbounded.
--
-- This migration makes the RPC self-defending, still `anon`-executable, with
-- NO service_role, NO new privileged role and NO shared secret:
--
--   1. submission_rate_buckets  — a generic atomic fixed-window counter table.
--      RLS enabled, no policy, and EXECUTE/ALL explicitly revoked from
--      PUBLIC/anon/authenticated — unreachable through the API.
--   2. bump_rate_bucket(key,max,window) — SECURITY DEFINER, search_path
--      locked to '', EXECUTE revoked from PUBLIC/anon/authenticated; only
--      submit_application (owned by postgres, same owner) can call it.
--   3. submit_application re-created with the SAME 10-arg signature and the
--      SAME org/program/status/dedup/creator/application/event logic, plus:
--        (a) jsonb_typeof checks on p_creator/p_answers/p_field_snapshot/
--            p_socials/p_utm — always evaluated before any jsonb_array_elements
--            / jsonb_object_keys / jsonb_each_text call on that value;
--        (b) total serialized-size caps on all five, measured in BYTES
--            (octet_length), not characters;
--        (c) p_answers key-count + per-value length caps;
--        (d) p_creator scalar length caps + a SEMANTIC birth_date check
--            (regex shape, then an actual ::date cast in a guarded
--            sub-block — "2026-99-99" is rejected here, not by an
--            uncaught cast error later);
--        (e) p_socials shape caps (count, platform, handle/url lengths,
--            numeric guards);
--        (f) p_referrer / p_source / UTM length caps — REJECTED, not
--            truncated;
--        (g) per-program flood cap (atomic);
--        (h) per-(program, identity) repeat-abuse cap (atomic).
--      All of (a)-(f) — every deterministic validation failure — and the
--      identity/dedup resolution (which decides whether MISSING_NAME fires)
--      run BEFORE (g)/(h). A rate-limit bump followed by any later
--      `raise exception` would roll back the whole transaction, including
--      the counter row bump_rate_bucket just wrote — silently un-metering
--      that attempt. Ordering everything that can still throw ahead of the
--      bumps closes that hole.
--
-- No historical migration is edited. Re-runnable.

-- ===========================================================================
-- 1. submission_rate_buckets — one row per rate-limit dimension:value.
-- ===========================================================================
create table if not exists public.submission_rate_buckets (
  bucket_key   text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 0
);

alter table public.submission_rate_buckets enable row level security;
-- No policy: RLS with zero policies denies every row to every role outright.
-- Belt-and-suspenders: explicit privilege revocation, so access is denied
-- even if RLS were ever disabled by mistake. Only bump_rate_bucket
-- (SECURITY DEFINER, owned by postgres) ever touches this table — it is
-- unreachable through PostgREST/the API for anon, authenticated, or any
-- other role.
revoke all on table public.submission_rate_buckets from public, anon, authenticated;

-- Index so the bounded opportunistic sweep in bump_rate_bucket is cheap.
create index if not exists submission_rate_buckets_window_idx
  on public.submission_rate_buckets (window_start);

-- ===========================================================================
-- 2. bump_rate_bucket — atomic check-and-increment for a fixed window.
--    Returns TRUE while the caller is within `p_max`, FALSE once exceeded.
--    Concurrency-safe: the INSERT ... ON CONFLICT DO UPDATE ... RETURNING is a
--    single atomic statement, so two simultaneous callers get two distinct
--    incremented counts and cannot both be admitted past the limit.
-- ===========================================================================
create or replace function public.bump_rate_bucket(
  p_key text,
  p_max int,
  p_window_secs int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now    timestamptz := now();
  v_window interval := make_interval(secs => greatest(coalesce(p_window_secs, 600), 1));
  v_max    int := greatest(coalesce(p_max, 1), 1);
  v_count  int;
begin
  -- Unusable key -> fail open, write nothing.
  if p_key is null or char_length(p_key) = 0 or char_length(p_key) > 200 then
    return true;
  end if;

  -- Bounded, occasional cleanup — never a full scan on the hot path. Uses the
  -- window_start index; capped at 200 rows; ~1% of calls. An operator MAY also
  -- schedule `delete from public.submission_rate_buckets where window_start <
  -- now() - interval '1 day'` via pg_cron for a fuller sweep.
  if random() < 0.01 then
    delete from public.submission_rate_buckets t
    using (
      select ctid from public.submission_rate_buckets
      where window_start < v_now - interval '2 hours'
      limit 200
    ) d
    where t.ctid = d.ctid;
  end if;

  insert into public.submission_rate_buckets as b (bucket_key, window_start, count)
  values (p_key, v_now, 1)
  on conflict (bucket_key) do update
    set count = case
          when b.window_start < v_now - v_window then 1
          else b.count + 1
        end,
        window_start = case
          when b.window_start < v_now - v_window then v_now
          else b.window_start
        end
  returning count into v_count;

  return v_count <= v_max;
end;
$$;

-- Explicit least-privilege: no ambient EXECUTE anywhere, for any role. Do not
-- rely on the mere absence of a GRANT — revoke is stated for PUBLIC (twice:
-- the blanket ALL and the specific EXECUTE, since a future grant to PUBLIC
-- would otherwise silently re-open this), anon, and authenticated. Only the
-- function OWNER (postgres) can execute it: a SECURITY DEFINER function's own
-- body is checked against its owner's privileges, which is how
-- submit_application (also owned by postgres) can still call it internally
-- while nothing external can call it directly.
revoke all     on function public.bump_rate_bucket(text, int, int) from public;
revoke execute on function public.bump_rate_bucket(text, int, int) from public;
revoke execute on function public.bump_rate_bucket(text, int, int) from anon;
revoke execute on function public.bump_rate_bucket(text, int, int) from authenticated;

-- ===========================================================================
-- 3. submit_application — current body (20260829000001) + SEC-003 hardening.
-- ===========================================================================
create or replace function public.submit_application(
  p_org_slug       text,
  p_program_slug   text,
  p_form_version   integer,
  p_answers        jsonb,
  p_field_snapshot jsonb,
  p_creator        jsonb,
  p_socials        jsonb,
  p_utm            jsonb,
  p_referrer       text,
  p_source         text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_id       uuid;
  v_program_id   uuid;
  v_status       text;
  v_creator_id   uuid;
  v_primary_id   uuid;              -- set ONLY by strong signals (ig/tt/email)
  v_matched      uuid[] := '{}';    -- every creator any signal points at
  v_tmp          uuid;
  v_possible_dup boolean := false;
  v_app_id       uuid;
  s              jsonb;
  v_full_name    text := nullif(btrim(p_creator->>'full_name'), '');
  v_email        text := nullif(lower(btrim(p_creator->>'email')), '');
  v_phone        text := nullif(btrim(p_creator->>'phone_e164'), '');
  v_ig           text := nullif((
                    select x->>'handle_normalized'
                    from jsonb_array_elements(
                           case when jsonb_typeof(p_socials) = 'array'
                                then p_socials else '[]'::jsonb end) x
                    where x->>'platform' = 'instagram'
                      and nullif(x->>'handle_normalized', '') is not null
                    limit 1), '');
  v_tt           text := nullif((
                    select x->>'handle_normalized'
                    from jsonb_array_elements(
                           case when jsonb_typeof(p_socials) = 'array'
                                then p_socials else '[]'::jsonb end) x
                    where x->>'platform' = 'tiktok'
                      and nullif(x->>'handle_normalized', '') is not null
                    limit 1), '');
  v_identity     text;
  v_lock_key     text;
begin
  select p.id, p.status, p.organization_id
    into v_program_id, v_status, v_org_id
  from public.programs p
  join public.organizations o on o.id = p.organization_id
  where o.slug = p_org_slug and p.slug = p_program_slug;

  if v_program_id is null then
    raise exception 'PROGRAM_NOT_FOUND';
  end if;
  if v_status <> 'active' then
    raise exception 'PROGRAM_NOT_ACCEPTING';
  end if;

  -- ========================= SEC-003 input hardening =======================
  -- (a) structural type checks — reject anything that is not the expected
  --     JSON container. A SQL NULL is allowed (coalesced below, as before).
  --     This MUST run before any jsonb_array_elements / jsonb_object_keys /
  --     jsonb_each_text call on these values (sections b-f below), so a
  --     malformed container never reaches those functions.
  if p_creator        is not null and jsonb_typeof(p_creator)        <> 'object' then raise exception 'INVALID_PAYLOAD'; end if;
  if p_answers        is not null and jsonb_typeof(p_answers)        <> 'object' then raise exception 'INVALID_PAYLOAD'; end if;
  if p_field_snapshot is not null and jsonb_typeof(p_field_snapshot) <> 'array'  then raise exception 'INVALID_PAYLOAD'; end if;
  if p_socials        is not null and jsonb_typeof(p_socials)        <> 'array'  then raise exception 'INVALID_PAYLOAD'; end if;
  if p_utm            is not null and jsonb_typeof(p_utm)            <> 'object' then raise exception 'INVALID_PAYLOAD'; end if;

  -- (b) total serialized-size caps on every JSON input, measured in BYTES
  --     (octet_length on the ::text serialization), not characters — a
  --     multi-byte-heavy payload (e.g. accented text, emoji) could otherwise
  --     land well under a character-count cap while still being several
  --     times the intended byte budget.
  if octet_length(coalesce(p_answers,        '{}'::jsonb)::text) > 20000 then raise exception 'PAYLOAD_TOO_LARGE'; end if;
  if octet_length(coalesce(p_field_snapshot, '[]'::jsonb)::text) > 20000 then raise exception 'PAYLOAD_TOO_LARGE'; end if;
  if octet_length(coalesce(p_creator,        '{}'::jsonb)::text) >  4000 then raise exception 'PAYLOAD_TOO_LARGE'; end if;
  if octet_length(coalesce(p_socials,        '[]'::jsonb)::text) >  4000 then raise exception 'PAYLOAD_TOO_LARGE'; end if;
  if octet_length(coalesce(p_utm,            '{}'::jsonb)::text) >  2000 then raise exception 'PAYLOAD_TOO_LARGE'; end if;

  -- (c) answers: field count + per-value length.
  if (select count(*) from jsonb_object_keys(coalesce(p_answers, '{}'::jsonb))) > 60 then
    raise exception 'TOO_MANY_FIELDS';
  end if;
  if exists (
    select 1 from jsonb_each_text(coalesce(p_answers, '{}'::jsonb)) kv
    where char_length(kv.value) > 5000
  ) then
    raise exception 'ANSWER_TOO_LONG';
  end if;

  -- (d) creator scalar length + SEMANTIC birth_date validation.
  if char_length(coalesce(p_creator->>'full_name', ''))     > 150 then raise exception 'INVALID_PAYLOAD'; end if;
  if char_length(coalesce(p_creator->>'preferred_name', '')) > 120 then raise exception 'INVALID_PAYLOAD'; end if;
  if char_length(coalesce(p_creator->>'email', ''))         > 254 then raise exception 'INVALID_PAYLOAD'; end if;
  if char_length(coalesce(p_creator->>'phone_e164', ''))    >  32 then raise exception 'INVALID_PAYLOAD'; end if;
  if char_length(coalesce(p_creator->>'city', ''))          > 120 then raise exception 'INVALID_PAYLOAD'; end if;
  if char_length(coalesce(p_creator->>'state', ''))         >  40 then raise exception 'INVALID_PAYLOAD'; end if;
  if char_length(coalesce(p_creator->>'postal_code', ''))   >  16 then raise exception 'INVALID_PAYLOAD'; end if;
  if nullif(p_creator->>'birth_date', '') is not null then
    if nullif(p_creator->>'birth_date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'INVALID_PAYLOAD';
    end if;
    -- Shape alone ("YYYY-MM-DD") lets "2026-99-99" or "2026-02-30" through —
    -- neither is a real calendar date. Attempt the real cast now, inside its
    -- own guarded sub-block, and turn a date/time field out of range (or any
    -- other cast error) into our own clean INVALID_PAYLOAD, BEFORE the rate
    -- limit bumps below — not later, where the same cast is repeated on the
    -- insert/update path and an uncaught error there would roll back the
    -- transaction (counter bump included).
    begin
      perform (nullif(p_creator->>'birth_date', ''))::date;
    exception when others then
      raise exception 'INVALID_PAYLOAD';
    end;
  end if;

  -- (e) socials: count + per-entry shape.
  if jsonb_array_length(coalesce(p_socials, '[]'::jsonb)) > 5 then raise exception 'INVALID_PAYLOAD'; end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(p_socials, '[]'::jsonb)) e
    where coalesce(e->>'platform', '') not in ('instagram', 'tiktok')
       or char_length(coalesce(e->>'handle', ''))            > 120
       or char_length(coalesce(e->>'handle_normalized', '')) > 120
       or char_length(coalesce(e->>'profile_url', ''))       > 300
       or (nullif(e->>'followers_declared', '')     is not null
           and nullif(e->>'followers_declared', '')     !~ '^[0-9]{1,15}$')
       or (nullif(e->>'average_views_declared', '') is not null
           and nullif(e->>'average_views_declared', '') !~ '^[0-9]{1,15}$')
  ) then
    raise exception 'INVALID_PAYLOAD';
  end if;
  -- Every followers/views string that passes here is 1-15 digits, so the
  -- ::bigint casts in the social upsert loop far below (bigint max is
  -- ~9.22e18; 15 nines is ~1e15) can never throw either.

  -- (f) metadata length — REJECT (do not silently truncate).
  if p_referrer is not null and char_length(p_referrer) > 500 then raise exception 'INVALID_PAYLOAD'; end if;
  if p_source   is not null and char_length(p_source)   >  60 then raise exception 'INVALID_PAYLOAD'; end if;
  if exists (
    select 1 from (values ('source'),('medium'),('campaign'),('content'),('term')) k(name)
    where char_length(coalesce(p_utm->>k.name, '')) > 150
  ) then
    raise exception 'INVALID_PAYLOAD';
  end if;
  -- ======================= end SEC-003 payload validation ==================

  -- Serialize concurrent submissions of the same person in this org. Moved
  -- ahead of the rate-limit bumps (was after, in the first draft of this
  -- migration) together with the dedup resolution just below, specifically
  -- so the one remaining deterministic exception in this function —
  -- MISSING_NAME — can be checked and raised before any bump, not after.
  v_lock_key := coalesce(v_ig, v_tt, v_email, v_phone, gen_random_uuid()::text);
  perform pg_advisory_xact_lock(hashtext(v_org_id::text || '|' || v_lock_key));

  -- Strong signals — merge automatically. Priority: instagram -> tiktok -> email.
  if v_ig is not null then
    select creator_id into v_tmp from public.creator_social_profiles
    where organization_id = v_org_id and platform = 'instagram'
      and handle_normalized = v_ig limit 1;
    if v_tmp is not null then
      v_primary_id := coalesce(v_primary_id, v_tmp);
      if not (v_tmp = any (v_matched)) then v_matched := v_matched || v_tmp; end if;
    end if;
  end if;

  if v_tt is not null then
    select creator_id into v_tmp from public.creator_social_profiles
    where organization_id = v_org_id and platform = 'tiktok'
      and handle_normalized = v_tt limit 1;
    if v_tmp is not null then
      v_primary_id := coalesce(v_primary_id, v_tmp);
      if not (v_tmp = any (v_matched)) then v_matched := v_matched || v_tmp; end if;
    end if;
  end if;

  if v_email is not null then
    select id into v_tmp from public.creators
    where organization_id = v_org_id and lower(email) = v_email
      and archived_at is null limit 1;
    if v_tmp is not null then
      v_primary_id := coalesce(v_primary_id, v_tmp);
      if not (v_tmp = any (v_matched)) then v_matched := v_matched || v_tmp; end if;
    end if;
  end if;

  -- Soft signal — phone. Recorded for the possible_duplicate flag, but it NEVER
  -- becomes the primary creator: a shared/re-used number must not merge people.
  if v_phone is not null then
    select id into v_tmp from public.creators
    where organization_id = v_org_id and phone_e164 = v_phone
      and archived_at is null limit 1;
    if v_tmp is not null and not (v_tmp = any (v_matched)) then
      v_matched := v_matched || v_tmp;
    end if;
  end if;

  -- ========================= SEC-003 rate limiting ==========================
  -- MISSING_NAME, hoisted: with dedup now resolved above, we already know
  -- whether this submission will need a name (no strong-signal match) or not.
  -- Raising it here — before either bump below — means a nameless,
  -- non-matching payload can never consume (and then roll back) a rate-limit
  -- slot. The identical check is still in place, unchanged, in its original
  -- spot inside the insert branch further down as a second, redundant gate.
  if v_primary_id is null and v_full_name is null then
    raise exception 'MISSING_NAME';
  end if;

  -- (g) per-program flood cap — atomic, concurrency-safe.
  if not public.bump_rate_bucket('sub:prog:' || v_program_id::text, 200, 600) then
    raise exception 'PROGRAM_RATE_LIMITED';
  end if;

  -- (h) per-(program, identity) repeat-abuse cap. Identity = the same strong
  --     signal used for the advisory lock; key is a program-scoped SHA-256,
  --     never a bare identity hash. Only when an identity signal exists.
  v_identity := coalesce(v_ig, v_tt, v_email, v_phone);
  if v_identity is not null then
    if not public.bump_rate_bucket(
      'sub:pid:' || encode(
        sha256(convert_to(v_program_id::text || '|' || lower(v_identity), 'UTF8')), 'hex'),
      20, 3600
    ) then
      raise exception 'IDENTITY_RATE_LIMITED';
    end if;
  end if;
  -- ======================= end SEC-003 rate limiting ========================

  if v_primary_id is null then
    -- No strong match -> new creator. If a phone (soft) match exists, flag it.
    if v_full_name is null then
      raise exception 'MISSING_NAME';
    end if;
    if array_length(v_matched, 1) is not null then
      v_possible_dup := true;
    end if;
    insert into public.creators (
      organization_id, full_name, preferred_name, birth_date,
      email, phone_e164, city, state, postal_code
    ) values (
      v_org_id, v_full_name,
      nullif(btrim(p_creator->>'preferred_name'), ''),
      nullif(p_creator->>'birth_date', '')::date,
      v_email, v_phone,
      nullif(btrim(p_creator->>'city'), ''),
      nullif(btrim(p_creator->>'state'), ''),
      nullif(btrim(p_creator->>'postal_code'), '')
    )
    returning id into v_creator_id;
  else
    v_creator_id := v_primary_id;
    if array_length(v_matched, 1) > 1 then
      v_possible_dup := true;
    end if;
    -- Backfill only missing contact fields on the matched creator.
    update public.creators set
      email          = coalesce(email, v_email),
      phone_e164     = coalesce(phone_e164, v_phone),
      preferred_name = coalesce(preferred_name, nullif(btrim(p_creator->>'preferred_name'), '')),
      birth_date     = coalesce(birth_date, nullif(p_creator->>'birth_date', '')::date),
      city           = coalesce(city, nullif(btrim(p_creator->>'city'), '')),
      state          = coalesce(state, nullif(btrim(p_creator->>'state'), '')),
      postal_code    = coalesce(postal_code, nullif(btrim(p_creator->>'postal_code'), '')),
      updated_at     = now()
    where id = v_creator_id;
  end if;

  -- Upsert social profiles. creator_id is deliberately NOT touched on conflict:
  -- a handle already owned by another creator stays with them (no merge).
  for s in
    select value from jsonb_array_elements(coalesce(p_socials, '[]'::jsonb))
  loop
    if nullif(s->>'handle_normalized', '') is null then
      continue;
    end if;
    insert into public.creator_social_profiles as csp (
      organization_id, creator_id, platform, handle, handle_normalized,
      profile_url, followers_declared, average_views_declared
    ) values (
      v_org_id, v_creator_id, s->>'platform',
      coalesce(nullif(s->>'handle', ''), s->>'handle_normalized'),
      s->>'handle_normalized',
      nullif(s->>'profile_url', ''),
      nullif(s->>'followers_declared', '')::bigint,
      nullif(s->>'average_views_declared', '')::bigint
    )
    on conflict (organization_id, platform, handle_normalized) do update set
      handle                 = excluded.handle,
      profile_url            = coalesce(excluded.profile_url, csp.profile_url),
      followers_declared     = coalesce(excluded.followers_declared, csp.followers_declared),
      average_views_declared = coalesce(excluded.average_views_declared, csp.average_views_declared),
      updated_at             = now();
  end loop;

  insert into public.applications (
    organization_id, program_id, creator_id, status, form_version,
    answers, field_snapshot, possible_duplicate,
    source, referrer,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term,
    submitted_at
  ) values (
    v_org_id, v_program_id, v_creator_id, 'new', coalesce(p_form_version, 1),
    coalesce(p_answers, '{}'::jsonb), coalesce(p_field_snapshot, '[]'::jsonb), v_possible_dup,
    nullif(btrim(p_source), ''), nullif(btrim(p_referrer), ''),
    nullif(btrim(p_utm->>'source'), ''), nullif(btrim(p_utm->>'medium'), ''),
    nullif(btrim(p_utm->>'campaign'), ''), nullif(btrim(p_utm->>'content'), ''),
    nullif(btrim(p_utm->>'term'), ''),
    now()
  )
  returning id into v_app_id;

  insert into public.creator_events (organization_id, creator_id, application_id, type, data)
  values (
    v_org_id, v_creator_id, v_app_id, 'application_submitted',
    jsonb_build_object('program_id', v_program_id, 'possible_duplicate', v_possible_dup)
  );

  return jsonb_build_object(
    'ok', true,
    'possible_duplicate', v_possible_dup,
    'application_id', v_app_id,
    'creator_id', v_creator_id
  );
end;
$$;

revoke all on function public.submit_application(
  text, text, integer, jsonb, jsonb, jsonb, jsonb, jsonb, text, text
) from public;
grant execute on function public.submit_application(
  text, text, integer, jsonb, jsonb, jsonb, jsonb, jsonb, text, text
) to anon, authenticated;
