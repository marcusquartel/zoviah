-- Creator Hub — Phase 4: approval → secure address request → complete profile.
--
-- Adds two application statuses (awaiting_address, completed), a table of
-- token-gated supplemental requests (application_requests) and a table of
-- collected shipping addresses (creator_addresses). The raw token is NEVER
-- stored — only its SHA-256 hash. Address data is PII: it never enters
-- creator_events, is never sent to Claude, never appears in the CRM list.
--
-- No migration edited. `create or replace` keeps grants/ownership on the
-- functions it replaces (transition_application_status, crm_counts,
-- is_valid_application_transition).

-- ===========================================================================
-- 1. application status machine — two new states
-- ===========================================================================
alter table public.applications drop constraint applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in (
    'new', 'awaiting_review', 'information_requested', 'approved',
    'awaiting_address', 'completed', 'archived'
  ));

-- Full conceptual graph. The two "secure-only" edges (approved →
-- awaiting_address, awaiting_address → completed) live here so the invariant
-- checks pass, but transition_application_status refuses them for a manual
-- caller (see below) — they only happen inside the address-request RPCs.
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
    ('approved', 'awaiting_address'),
    ('awaiting_address', 'completed'),
    ('awaiting_address', 'approved'),
    ('awaiting_address', 'archived'),
    ('completed', 'archived'),
    ('archived', 'awaiting_review')
  );
$$;

grant execute on function public.is_valid_application_transition(text, text) to authenticated;

-- ===========================================================================
-- 2. application_requests — token-gated supplemental request
-- ===========================================================================
create table public.application_requests (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  application_id   uuid not null references public.applications (id) on delete cascade,
  creator_id       uuid not null references public.creators (id) on delete cascade,

  request_type     text not null check (request_type in ('shipping_address')),
  status           text not null check (status in ('pending', 'completed', 'expired', 'revoked')),

  token_hash       text not null,          -- SHA-256 hex of the raw token; raw NEVER stored
  expires_at       timestamptz not null,

  completed_at     timestamptz,
  revoked_at       timestamptz,
  consent_at       timestamptz,

  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Fast, unique lookup by hash (§69).
create unique index application_requests_token_hash_key
  on public.application_requests (token_hash);

-- At most one live request per application per type (§18). Expired-but-still-
-- 'pending' rows are swept to 'expired' by create_address_request before this
-- bites.
create unique index application_requests_one_pending_idx
  on public.application_requests (application_id, request_type)
  where status = 'pending';

create index application_requests_application_created_idx
  on public.application_requests (application_id, created_at desc);
create index application_requests_org_status_created_idx
  on public.application_requests (organization_id, status, created_at desc);

create trigger application_requests_set_updated_at
  before update on public.application_requests
  for each row execute function public.set_updated_at();

alter table public.application_requests enable row level security;

-- Members read requests of their own org. Writes: RPCs only (no policy).
create policy application_requests_select_member
  on public.application_requests for select to authenticated
  using (public.is_organization_member(organization_id));

-- ===========================================================================
-- 3. creator_addresses — collected shipping address, versioned per creator
-- ===========================================================================
create table public.creator_addresses (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  creator_id        uuid not null references public.creators (id) on delete cascade,

  recipient_name    text not null check (char_length(recipient_name) between 1 and 150),
  postal_code       text not null check (postal_code ~ '^[0-9]{8}$'),
  street            text not null check (char_length(street) between 1 and 200),
  number            text not null check (char_length(number) between 1 and 50),
  complement        text          check (complement is null or char_length(complement) <= 150),
  neighborhood      text not null check (char_length(neighborhood) between 1 and 150),
  city              text not null check (char_length(city) between 1 and 150),
  state             text not null check (state ~ '^[A-Z]{2}$'),
  country           text not null default 'BR' check (country = 'BR'),

  source_request_id uuid not null references public.application_requests (id) on delete restrict,
  is_current        boolean not null default true,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Exactly one current address per creator per tenant (§34).
create unique index creator_addresses_one_current_idx
  on public.creator_addresses (organization_id, creator_id)
  where is_current;

create index creator_addresses_creator_current_idx
  on public.creator_addresses (creator_id, is_current);

create trigger creator_addresses_set_updated_at
  before update on public.creator_addresses
  for each row execute function public.set_updated_at();

alter table public.creator_addresses enable row level security;

-- Members read addresses of their own org. Writes: RPC only (no policy).
create policy creator_addresses_select_member
  on public.creator_addresses for select to authenticated
  using (public.is_organization_member(organization_id));

-- ===========================================================================
-- 4. transition_application_status — re-created with a guard.
--
-- Identical to 20260828000002 PLUS: a manual caller may not move an
-- application INTO awaiting_address / completed, nor awaiting_address →
-- approved (that is "revoke" and must run atomically with the request). When
-- an awaiting_address application is archived, any pending request is revoked
-- so "awaiting_address ⟺ live pending request" stays true.
-- ===========================================================================
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

  -- Secure-request flow owns these edges (§45).
  if p_to_status in ('awaiting_address', 'completed')
     or (v_from = 'awaiting_address' and p_to_status = 'approved') then
    raise exception 'USE_ADDRESS_REQUEST_FLOW';
  end if;

  if not public.is_valid_application_transition(v_from, p_to_status) then
    raise exception 'INVALID_TRANSITION: % -> %', v_from, p_to_status;
  end if;

  select email into v_email from auth.users where id = v_uid;

  update public.applications set
    status      = p_to_status,
    approved_at = case
                    when p_to_status = 'approved' then now()
                    when p_to_status = 'archived' then approved_at
                    when p_to_status = 'completed' then approved_at
                    else null
                  end,
    archived_at = case
                    when p_to_status = 'archived' then now()
                    when v_from = 'archived' then null
                    else archived_at
                  end
  where id = p_application_id;

  -- Archiving out of awaiting_address kills the dangling pending request.
  if v_from = 'awaiting_address' and p_to_status = 'archived' then
    update public.application_requests set
      status = 'revoked', revoked_at = now(), updated_at = now()
    where application_id = p_application_id
      and request_type = 'shipping_address'
      and status = 'pending';
  end if;

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

-- ===========================================================================
-- 5. crm_counts — two extra counters
-- ===========================================================================
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
    'awaiting_address',      count(*) filter (where status = 'awaiting_address'),
    'completed',             count(*) filter (where status = 'completed'),
    'archived',              count(*) filter (where status = 'archived'),
    'possible_duplicate',    count(*) filter (where possible_duplicate)
  )
  from public.applications
  where (p_program_id is null or program_id = p_program_id);
$$;

grant execute on function public.crm_counts(uuid) to authenticated;

-- ===========================================================================
-- 6. create_address_request(application_id, token_hash) — admin, SECURITY DEFINER
-- ===========================================================================
create or replace function public.create_address_request(
  p_application_id uuid,
  p_token_hash     text
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
  v_status  text;
  v_id      uuid;
  v_email   text;
  v_expires timestamptz := now() + interval '7 days';  -- ADDRESS_REQUEST_TTL_DAYS
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    raise exception 'BAD_TOKEN_HASH';
  end if;
  select email into v_email from auth.users where id = v_uid;

  select organization_id, creator_id, status
    into v_org, v_creator, v_status
  from public.applications
  where id = p_application_id
  for update;

  if v_org is null then
    raise exception 'APPLICATION_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org and user_id = v_uid
  ) then
    raise exception 'FORBIDDEN';
  end if;

  -- Sweep an expired-but-still-pending request so the partial unique index
  -- won't block a fresh one (§18).
  update public.application_requests set
    status = 'expired', updated_at = now()
  where application_id = p_application_id
    and request_type = 'shipping_address'
    and status = 'pending'
    and expires_at < now();

  if v_status <> 'approved' then
    raise exception 'APPLICATION_NOT_APPROVED';
  end if;

  insert into public.application_requests (
    organization_id, application_id, creator_id,
    request_type, status, token_hash, expires_at, created_by
  ) values (
    v_org, p_application_id, v_creator,
    'shipping_address', 'pending', p_token_hash, v_expires, v_uid
  )
  returning id into v_id;

  -- Direct status write (bypasses the manual guard); approved_at untouched.
  update public.applications set status = 'awaiting_address'
  where id = p_application_id;

  insert into public.creator_events
    (organization_id, creator_id, application_id, type, actor_user_id, data)
  values (
    v_org, v_creator, p_application_id, 'address_request_created', v_uid,
    jsonb_build_object('request_id', v_id, 'expires_at', v_expires, 'actor_email', v_email)
  );

  return jsonb_build_object('ok', true, 'request_id', v_id, 'expires_at', v_expires);
end;
$$;

revoke all on function public.create_address_request(uuid, text) from public;
grant execute on function public.create_address_request(uuid, text) to authenticated;

-- ===========================================================================
-- 7. regenerate_address_request(application_id, token_hash) — admin
-- ===========================================================================
create or replace function public.regenerate_address_request(
  p_application_id uuid,
  p_token_hash     text
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
  v_status  text;
  v_id      uuid;
  v_email   text;
  v_expires timestamptz := now() + interval '7 days';
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    raise exception 'BAD_TOKEN_HASH';
  end if;
  select email into v_email from auth.users where id = v_uid;

  select organization_id, creator_id, status
    into v_org, v_creator, v_status
  from public.applications
  where id = p_application_id
  for update;

  if v_org is null then
    raise exception 'APPLICATION_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org and user_id = v_uid
  ) then
    raise exception 'FORBIDDEN';
  end if;
  if v_status <> 'awaiting_address' then
    raise exception 'NO_ACTIVE_REQUEST';
  end if;

  -- Revoke the previous pending token, then mint a new one. Application stays
  -- in awaiting_address — no artificial status bounce (§17).
  update public.application_requests set
    status = 'revoked', revoked_at = now(), updated_at = now()
  where application_id = p_application_id
    and request_type = 'shipping_address'
    and status = 'pending';

  insert into public.application_requests (
    organization_id, application_id, creator_id,
    request_type, status, token_hash, expires_at, created_by
  ) values (
    v_org, p_application_id, v_creator,
    'shipping_address', 'pending', p_token_hash, v_expires, v_uid
  )
  returning id into v_id;

  insert into public.creator_events
    (organization_id, creator_id, application_id, type, actor_user_id, data)
  values (
    v_org, v_creator, p_application_id, 'address_request_regenerated', v_uid,
    jsonb_build_object('request_id', v_id, 'expires_at', v_expires, 'actor_email', v_email)
  );

  return jsonb_build_object('ok', true, 'request_id', v_id, 'expires_at', v_expires);
end;
$$;

revoke all on function public.regenerate_address_request(uuid, text) from public;
grant execute on function public.regenerate_address_request(uuid, text) to authenticated;

-- ===========================================================================
-- 8. revoke_address_request(application_id) — admin
-- ===========================================================================
create or replace function public.revoke_address_request(
  p_application_id uuid
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
  v_status  text;
  v_email   text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select organization_id, creator_id, status
    into v_org, v_creator, v_status
  from public.applications
  where id = p_application_id
  for update;

  if v_org is null then
    raise exception 'APPLICATION_NOT_FOUND';
  end if;
  if not exists (
    select 1 from public.organization_members
    where organization_id = v_org and user_id = v_uid
  ) then
    raise exception 'FORBIDDEN';
  end if;
  if v_status <> 'awaiting_address' then
    raise exception 'NO_ACTIVE_REQUEST';
  end if;

  select email into v_email from auth.users where id = v_uid;

  update public.application_requests set
    status = 'revoked', revoked_at = now(), updated_at = now()
  where application_id = p_application_id
    and request_type = 'shipping_address'
    and status = 'pending';

  -- Back to approved; approved_at preserved (§8, §44).
  update public.applications set status = 'approved'
  where id = p_application_id;

  insert into public.creator_events
    (organization_id, creator_id, application_id, type, actor_user_id, data)
  values (
    v_org, v_creator, p_application_id, 'address_request_revoked', v_uid,
    jsonb_build_object('actor_email', v_email)
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.revoke_address_request(uuid) from public;
grant execute on function public.revoke_address_request(uuid) to authenticated;

-- ===========================================================================
-- 9. get_public_address_request(token_hash) — anon, SECURITY DEFINER
--
-- Returns ONLY branding + program name + expiry + a coarse status. No PII, no
-- answers, no score, no previous address. Invalid / revoked / expired all map
-- to the same opaque 'invalid' (§39, §78). Lazily flips an over-due pending
-- request to 'expired'.
-- ===========================================================================
create or replace function public.get_public_address_request(
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req  public.application_requests%rowtype;
  v_org_name text;
  v_logo text;
  v_primary text;
  v_secondary text;
  v_program text;
begin
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    return jsonb_build_object('status', 'invalid');
  end if;

  select * into v_req
  from public.application_requests
  where token_hash = p_token_hash;

  if not found or v_req.request_type <> 'shipping_address' then
    return jsonb_build_object('status', 'invalid');
  end if;

  if v_req.status = 'pending' and v_req.expires_at < now() then
    update public.application_requests set status = 'expired', updated_at = now()
    where id = v_req.id;
    v_req.status := 'expired';
  end if;

  if v_req.status in ('revoked', 'expired') then
    return jsonb_build_object('status', 'invalid');
  end if;

  select o.name, s.logo_url, s.primary_color, s.secondary_color, p.name
    into v_org_name, v_logo, v_primary, v_secondary, v_program
  from public.applications a
  join public.organizations o on o.id = a.organization_id
  left join public.organization_settings s on s.organization_id = o.id
  left join public.programs p on p.id = a.program_id
  where a.id = v_req.application_id;

  if v_req.status = 'completed' then
    return jsonb_build_object(
      'status', 'completed',
      'organization', jsonb_build_object(
        'name', v_org_name, 'logo_url', v_logo,
        'primary_color', v_primary, 'secondary_color', v_secondary
      )
    );
  end if;

  return jsonb_build_object(
    'status', 'pending',
    'organization', jsonb_build_object(
      'name', v_org_name, 'logo_url', v_logo,
      'primary_color', v_primary, 'secondary_color', v_secondary
    ),
    'program_name', v_program,
    'expires_at', v_req.expires_at
  );
end;
$$;

revoke all on function public.get_public_address_request(text) from public;
grant execute on function public.get_public_address_request(text) to anon, authenticated;

-- ===========================================================================
-- 10. complete_address_request(token_hash, payload) — anon, SECURITY DEFINER
--
-- Atomic: lock request → validate → mark old address non-current → insert new
-- address → request completed → application completed → event (no PII). Idem-
-- potent once completed (§37). Payload is normalized/validated server-side
-- (§28); the CHECK constraints on creator_addresses are the last line.
-- ===========================================================================
create or replace function public.complete_address_request(
  p_token_hash text,
  p_payload    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req    public.application_requests%rowtype;
  v_app_status text;
  v_org    uuid;
  v_creator uuid;
  v_recipient text := btrim(coalesce(p_payload->>'recipient_name', ''));
  v_postal text := regexp_replace(coalesce(p_payload->>'postal_code', ''), '[^0-9]', '', 'g');
  v_street text := btrim(coalesce(p_payload->>'street', ''));
  v_number text := btrim(coalesce(p_payload->>'number', ''));
  v_complement text := nullif(btrim(coalesce(p_payload->>'complement', '')), '');
  v_neighborhood text := btrim(coalesce(p_payload->>'neighborhood', ''));
  v_city   text := btrim(coalesce(p_payload->>'city', ''));
  v_state  text := upper(btrim(coalesce(p_payload->>'state', '')));
  v_consent boolean := (p_payload->>'consent') in ('true', 't', '1');
  v_addr_id uuid;
begin
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    raise exception 'INVALID_LINK';
  end if;

  select * into v_req
  from public.application_requests
  where token_hash = p_token_hash
  for update;

  if not found or v_req.request_type <> 'shipping_address' then
    raise exception 'INVALID_LINK';
  end if;

  if v_req.status = 'pending' and v_req.expires_at < now() then
    update public.application_requests set status = 'expired', updated_at = now()
    where id = v_req.id;
    raise exception 'INVALID_LINK';
  end if;

  -- Idempotent: a retry / double-submit on a finished request is a no-op.
  if v_req.status = 'completed' then
    return jsonb_build_object('status', 'already_completed');
  end if;
  if v_req.status <> 'pending' then
    raise exception 'INVALID_LINK';
  end if;

  select status, organization_id, creator_id
    into v_app_status, v_org, v_creator
  from public.applications
  where id = v_req.application_id
  for update;

  if v_app_status is null or v_app_status <> 'awaiting_address' then
    raise exception 'INVALID_LINK';
  end if;

  if not v_consent then
    raise exception 'CONSENT_REQUIRED';
  end if;

  if v_recipient = '' or v_street = '' or v_number = '' or v_neighborhood = ''
     or v_city = '' or char_length(v_postal) <> 8 or v_state !~ '^[A-Z]{2}$' then
    raise exception 'INVALID_ADDRESS';
  end if;
  if char_length(v_recipient) > 150 or char_length(v_street) > 200
     or char_length(v_number) > 50 or char_length(v_neighborhood) > 150
     or char_length(v_city) > 150
     or (v_complement is not null and char_length(v_complement) > 150) then
    raise exception 'INVALID_ADDRESS';
  end if;

  update public.creator_addresses set is_current = false, updated_at = now()
  where organization_id = v_org and creator_id = v_creator and is_current;

  insert into public.creator_addresses (
    organization_id, creator_id, recipient_name, postal_code, street, number,
    complement, neighborhood, city, state, country, source_request_id, is_current
  ) values (
    v_org, v_creator, v_recipient, v_postal, v_street, v_number,
    v_complement, v_neighborhood, v_city, v_state, 'BR', v_req.id, true
  )
  returning id into v_addr_id;

  update public.application_requests set
    status = 'completed', completed_at = now(), consent_at = now(), updated_at = now()
  where id = v_req.id;

  update public.applications set status = 'completed'
  where id = v_req.application_id;

  -- Actor is null (public). NO address data in the event (§56, §58).
  insert into public.creator_events
    (organization_id, creator_id, application_id, type, actor_user_id, data)
  values (
    v_org, v_creator, v_req.application_id, 'address_submitted', null,
    jsonb_build_object('request_id', v_req.id, 'source', 'public_secure_request')
  );

  return jsonb_build_object('status', 'completed');
end;
$$;

revoke all on function public.complete_address_request(text, jsonb) from public;
grant execute on function public.complete_address_request(text, jsonb) to anon, authenticated;
