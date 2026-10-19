-- Zoviah — address + CPF at signup; the AI profile analysis is removed.
--
-- 1. The shipping address (CPF included) is collected on the public signup
--    form itself. `submit_application` gains a `p_address` argument and writes
--    the creator's current address in the same transaction.
-- 2. The address step leaves the status machine: `awaiting_address` and
--    `completed` are gone. Flow is new → (awaiting_review /
--    information_requested) → approved → archived. Existing rows in those two
--    states become `approved` (approved_at kept). An approved application with
--    a current address can receive shipments.
-- 3. The secure address link stays as a fallback (older signups, manual
--    entries, imports, address updates). It is now independent of the
--    application status: creating / regenerating / revoking / completing a
--    request never moves the application.
-- 4. The AI profile analysis (Creator Score) is dropped entirely:
--    creator_analyses, the applications cache columns, its RPCs, its stats,
--    its timeline events, and the admin counter. The manual metric snapshots
--    (social_metric_snapshots) are not AI and stay.
--
-- Supersedes, without editing them: 20260829000002 (status machine, request
-- RPCs, crm_counts), 20260901000002 (complete_address_request),
-- 20260829000004 (create_shipment), 20260903000001 (submit_application),
-- 20260828000003 / 20260828000004 (analysis), 20260831000001
-- (admin_get_organization).

-- The suspension gate would reject the data fixes below for a suspended org.
-- These are operator migrations, not panel writes: lift it for this
-- transaction only.
alter table public.applications disable trigger applications_block_suspended;

-- ===========================================================================
-- 1. Status machine — drop awaiting_address / completed
-- ===========================================================================
-- Pending secure links keep working (they no longer depend on the status).
update public.applications
   set status = 'approved'
 where status in ('awaiting_address', 'completed');

alter table public.applications drop constraint applications_status_check;
alter table public.applications add constraint applications_status_check
  check (status in (
    'new', 'awaiting_review', 'information_requested', 'approved', 'archived'
  ));

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

-- Body is the 20260829000002 version without the address-flow guard. Archiving
-- still revokes a pending address link so a dead application keeps no live
-- token.
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
    approved_at = case
                    when p_to_status = 'approved' then now()
                    when p_to_status = 'archived' then approved_at
                    else null
                  end,
    archived_at = case
                    when p_to_status = 'archived' then now()
                    when v_from = 'archived' then null
                    else archived_at
                  end
  where id = p_application_id;

  if p_to_status = 'archived' then
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

-- `approved_without_address` replaces the two removed status counters.
create or replace function public.crm_counts(p_program_id uuid default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'total_active',          count(*) filter (where a.status <> 'archived'),
    'new',                   count(*) filter (where a.status = 'new'),
    'awaiting_review',       count(*) filter (where a.status = 'awaiting_review'),
    'information_requested', count(*) filter (where a.status = 'information_requested'),
    'approved',              count(*) filter (where a.status = 'approved'),
    'archived',              count(*) filter (where a.status = 'archived'),
    'possible_duplicate',    count(*) filter (where a.possible_duplicate),
    'approved_without_address', count(*) filter (
      where a.status = 'approved'
        and not exists (
          select 1 from public.creator_addresses ca
          where ca.organization_id = a.organization_id
            and ca.creator_id = a.creator_id
            and ca.is_current
        )
    )
  )
  from public.applications a
  where (p_program_id is null or a.program_id = p_program_id);
$$;

grant execute on function public.crm_counts(uuid) to authenticated;

-- ===========================================================================
-- 2. creator_addresses — an address can now come from the signup form
-- ===========================================================================
alter table public.creator_addresses
  add column if not exists source text not null default 'secure_request';

alter table public.creator_addresses
  drop constraint if exists creator_addresses_source_check;
alter table public.creator_addresses
  add constraint creator_addresses_source_check
  check (
    (source = 'secure_request' and source_request_id is not null)
    or (source = 'signup' and source_request_id is null)
  );

alter table public.creator_addresses
  alter column source_request_id drop not null;

-- New rows must say where they came from.
alter table public.creator_addresses alter column source drop default;

-- ===========================================================================
-- 3. Secure address link — status-independent fallback
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
  if v_status = 'archived' then
    raise exception 'APPLICATION_ARCHIVED';
  end if;

  -- Sweep an expired-but-still-pending request so the partial unique index
  -- won't block a fresh one.
  update public.application_requests set
    status = 'expired', updated_at = now()
  where application_id = p_application_id
    and request_type = 'shipping_address'
    and status = 'pending'
    and expires_at < now();

  if exists (
    select 1 from public.application_requests
    where application_id = p_application_id
      and request_type = 'shipping_address'
      and status = 'pending'
  ) then
    raise exception 'REQUEST_ALREADY_PENDING';
  end if;

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
    v_org, v_creator, p_application_id, 'address_request_created', v_uid,
    jsonb_build_object('request_id', v_id, 'expires_at', v_expires, 'actor_email', v_email)
  );

  return jsonb_build_object('ok', true, 'request_id', v_id, 'expires_at', v_expires);
end;
$$;

revoke all on function public.create_address_request(uuid, text) from public;
grant execute on function public.create_address_request(uuid, text) to authenticated;

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

  select organization_id, creator_id
    into v_org, v_creator
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

  -- Revoke the previous pending token (expired or not), then mint a new one.
  update public.application_requests set
    status = 'revoked', revoked_at = now(), updated_at = now()
  where application_id = p_application_id
    and request_type = 'shipping_address'
    and status = 'pending';

  if not found then
    raise exception 'NO_ACTIVE_REQUEST';
  end if;

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
  v_email   text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  select organization_id, creator_id
    into v_org, v_creator
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

  update public.application_requests set
    status = 'revoked', revoked_at = now(), updated_at = now()
  where application_id = p_application_id
    and request_type = 'shipping_address'
    and status = 'pending';

  if not found then
    raise exception 'NO_ACTIVE_REQUEST';
  end if;

  select email into v_email from auth.users where id = v_uid;

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

-- Body is the 20260901000002 version minus the application-status check and
-- transition; the address is tagged source = 'secure_request'.
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
  v_cpf    text := regexp_replace(coalesce(p_payload->>'cpf', ''), '[^0-9]', '', 'g');
  v_postal text := regexp_replace(coalesce(p_payload->>'postal_code', ''), '[^0-9]', '', 'g');
  v_street text := btrim(coalesce(p_payload->>'street', ''));
  v_number text := btrim(coalesce(p_payload->>'number', ''));
  v_complement text := nullif(btrim(coalesce(p_payload->>'complement', '')), '');
  v_neighborhood text := btrim(coalesce(p_payload->>'neighborhood', ''));
  v_city   text := btrim(coalesce(p_payload->>'city', ''));
  v_state  text := upper(btrim(coalesce(p_payload->>'state', '')));
  v_consent boolean := (p_payload->>'consent') in ('true', 't', '1');
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

  if v_req.status = 'completed' then
    return jsonb_build_object('status', 'already_completed');
  end if;
  if v_req.status <> 'pending' then
    raise exception 'INVALID_LINK';
  end if;

  select status, organization_id, creator_id
    into v_app_status, v_org, v_creator
  from public.applications
  where id = v_req.application_id;

  if v_app_status is null or v_app_status = 'archived' then
    raise exception 'INVALID_LINK';
  end if;

  if not v_consent then
    raise exception 'CONSENT_REQUIRED';
  end if;

  if v_recipient = '' or v_street = '' or v_number = '' or v_neighborhood = ''
     or v_city = '' or char_length(v_postal) <> 8 or v_state !~ '^[A-Z]{2}$'
     or not public.is_valid_cpf(v_cpf) then
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
    organization_id, creator_id, recipient_name, cpf, postal_code, street, number,
    complement, neighborhood, city, state, country,
    source, source_request_id, is_current
  ) values (
    v_org, v_creator, v_recipient, v_cpf, v_postal, v_street, v_number,
    v_complement, v_neighborhood, v_city, v_state, 'BR',
    'secure_request', v_req.id, true
  );

  update public.application_requests set
    status = 'completed', completed_at = now(), consent_at = now(), updated_at = now()
  where id = v_req.id;

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

-- ===========================================================================
-- 4. create_shipment — approved (was: completed). Body otherwise unchanged
--    from 20260829000004.
-- ===========================================================================
create or replace function public.create_shipment(
  p_application_id uuid,
  p_items          jsonb,
  p_internal_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_org    uuid;
  v_creator uuid;
  v_status text;
  v_email  text;
  v_addr_id uuid;
  v_snap   jsonb;
  v_notes  text := nullif(btrim(coalesce(p_internal_notes, '')), '');
  v_id     uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if v_notes is not null and char_length(v_notes) > 2000 then
    raise exception 'INVALID_NOTES';
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
  if v_status <> 'approved' then
    raise exception 'APPLICATION_NOT_APPROVED';
  end if;

  perform public.assert_valid_shipment_items(p_items);
  select o_address_id, o_snapshot into v_addr_id, v_snap
  from public.build_address_snapshot(v_org, v_creator);

  insert into public.shipments (
    organization_id, creator_id, application_id,
    source_address_id, address_snapshot, status, internal_notes, created_by
  ) values (
    v_org, v_creator, p_application_id,
    v_addr_id, v_snap, 'draft', v_notes, v_uid
  )
  returning id into v_id;

  perform public.write_shipment_items(v_id, v_org, p_items);

  select email into v_email from auth.users where id = v_uid;
  insert into public.creator_events
    (organization_id, creator_id, application_id, type, actor_user_id, data)
  values (
    v_org, v_creator, p_application_id, 'shipment_created', v_uid,
    jsonb_build_object('shipment_id', v_id, 'actor_email', v_email)
  );

  return jsonb_build_object('ok', true, 'shipment_id', v_id);
end;
$$;

revoke all on function public.create_shipment(uuid, jsonb, text) from public;
grant execute on function public.create_shipment(uuid, jsonb, text) to authenticated;

-- ===========================================================================
-- 5. submit_application — + p_address. Body is the 20260903000001 (SEC-003)
--    version plus the address handling. The 10-arg overload is dropped so
--    there is exactly one entry point.
--
--    p_address is required for anonymous callers (the public form). An
--    authenticated member adding a creator by hand may omit it; that creator
--    then gets the secure link later.
-- ===========================================================================
drop function if exists public.submit_application(
  text, text, integer, jsonb, jsonb, jsonb, jsonb, jsonb, text, text
);

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
  p_source         text,
  p_address        jsonb default null
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
  -- address (normalized like complete_address_request)
  v_has_address  boolean := p_address is not null and p_address <> 'null'::jsonb;
  v_cpf          text;
  v_postal       text;
  v_street       text;
  v_number       text;
  v_complement   text;
  v_neighborhood text;
  v_city         text;
  v_state        text;
  v_recipient    text;
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
  -- (a) structural type checks — before any jsonb_* call on these values.
  if p_creator        is not null and jsonb_typeof(p_creator)        <> 'object' then raise exception 'INVALID_PAYLOAD'; end if;
  if p_answers        is not null and jsonb_typeof(p_answers)        <> 'object' then raise exception 'INVALID_PAYLOAD'; end if;
  if p_field_snapshot is not null and jsonb_typeof(p_field_snapshot) <> 'array'  then raise exception 'INVALID_PAYLOAD'; end if;
  if p_socials        is not null and jsonb_typeof(p_socials)        <> 'array'  then raise exception 'INVALID_PAYLOAD'; end if;
  if p_utm            is not null and jsonb_typeof(p_utm)            <> 'object' then raise exception 'INVALID_PAYLOAD'; end if;
  if v_has_address                and jsonb_typeof(p_address)        <> 'object' then raise exception 'INVALID_ADDRESS'; end if;

  -- (b) total serialized-size caps, in BYTES.
  if octet_length(coalesce(p_answers,        '{}'::jsonb)::text) > 20000 then raise exception 'PAYLOAD_TOO_LARGE'; end if;
  if octet_length(coalesce(p_field_snapshot, '[]'::jsonb)::text) > 20000 then raise exception 'PAYLOAD_TOO_LARGE'; end if;
  if octet_length(coalesce(p_creator,        '{}'::jsonb)::text) >  4000 then raise exception 'PAYLOAD_TOO_LARGE'; end if;
  if octet_length(coalesce(p_socials,        '[]'::jsonb)::text) >  4000 then raise exception 'PAYLOAD_TOO_LARGE'; end if;
  if octet_length(coalesce(p_utm,            '{}'::jsonb)::text) >  2000 then raise exception 'PAYLOAD_TOO_LARGE'; end if;
  if octet_length(coalesce(p_address,        '{}'::jsonb)::text) >  2000 then raise exception 'PAYLOAD_TOO_LARGE'; end if;

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

  -- (f) metadata length — REJECT (do not silently truncate).
  if p_referrer is not null and char_length(p_referrer) > 500 then raise exception 'INVALID_PAYLOAD'; end if;
  if p_source   is not null and char_length(p_source)   >  60 then raise exception 'INVALID_PAYLOAD'; end if;
  if exists (
    select 1 from (values ('source'),('medium'),('campaign'),('content'),('term')) k(name)
    where char_length(coalesce(p_utm->>k.name, '')) > 150
  ) then
    raise exception 'INVALID_PAYLOAD';
  end if;

  -- (g) shipping address — required for anonymous callers; validated with the
  --     same rules (and CHECK-equivalent caps) as complete_address_request.
  if not v_has_address then
    if (select auth.uid()) is null then
      raise exception 'ADDRESS_REQUIRED';
    end if;
  else
    v_cpf          := regexp_replace(coalesce(p_address->>'cpf', ''), '[^0-9]', '', 'g');
    v_postal       := regexp_replace(coalesce(p_address->>'postal_code', ''), '[^0-9]', '', 'g');
    v_street       := btrim(coalesce(p_address->>'street', ''));
    v_number       := btrim(coalesce(p_address->>'number', ''));
    v_complement   := nullif(btrim(coalesce(p_address->>'complement', '')), '');
    v_neighborhood := btrim(coalesce(p_address->>'neighborhood', ''));
    v_city         := btrim(coalesce(p_address->>'city', ''));
    v_state        := upper(btrim(coalesce(p_address->>'state', '')));

    if v_street = '' or v_number = '' or v_neighborhood = '' or v_city = ''
       or char_length(v_postal) <> 8 or v_state !~ '^[A-Z]{2}$'
       or not public.is_valid_cpf(v_cpf) then
      raise exception 'INVALID_ADDRESS';
    end if;
    if char_length(v_street) > 200 or char_length(v_number) > 50
       or char_length(v_neighborhood) > 150 or char_length(v_city) > 150
       or (v_complement is not null and char_length(v_complement) > 150) then
      raise exception 'INVALID_ADDRESS';
    end if;
  end if;
  -- ======================= end SEC-003 payload validation ==================

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

  -- Soft signal — phone. Never becomes the primary creator.
  if v_phone is not null then
    select id into v_tmp from public.creators
    where organization_id = v_org_id and phone_e164 = v_phone
      and archived_at is null limit 1;
    if v_tmp is not null and not (v_tmp = any (v_matched)) then
      v_matched := v_matched || v_tmp;
    end if;
  end if;

  -- ========================= SEC-003 rate limiting ==========================
  -- Every deterministic exception (incl. MISSING_NAME and the address checks)
  -- is raised above this line, so a rejected payload never consumes — and then
  -- rolls back — a rate-limit slot.
  if v_primary_id is null and v_full_name is null then
    raise exception 'MISSING_NAME';
  end if;

  if not public.bump_rate_bucket('sub:prog:' || v_program_id::text, 200, 600) then
    raise exception 'PROGRAM_RATE_LIMITED';
  end if;

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

  -- The newest address wins: it becomes the creator's current one. The
  -- recipient is the creator (name from this submission, else the record).
  if v_has_address then
    select coalesce(v_full_name, full_name) into v_recipient
    from public.creators where id = v_creator_id;

    update public.creator_addresses set is_current = false, updated_at = now()
    where organization_id = v_org_id and creator_id = v_creator_id and is_current;

    insert into public.creator_addresses (
      organization_id, creator_id, recipient_name, cpf, postal_code, street,
      number, complement, neighborhood, city, state, country,
      source, source_request_id, is_current
    ) values (
      v_org_id, v_creator_id, left(v_recipient, 150), v_cpf, v_postal, v_street,
      v_number, v_complement, v_neighborhood, v_city, v_state, 'BR',
      'signup', null, true
    );

    -- No PII in events.
    insert into public.creator_events (organization_id, creator_id, application_id, type, data)
    values (
      v_org_id, v_creator_id, v_app_id, 'address_submitted',
      jsonb_build_object('source', 'signup')
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'possible_duplicate', v_possible_dup,
    'application_id', v_app_id,
    'creator_id', v_creator_id
  );
end;
$$;

revoke all on function public.submit_application(
  text, text, integer, jsonb, jsonb, jsonb, jsonb, jsonb, text, text, jsonb
) from public;
grant execute on function public.submit_application(
  text, text, integer, jsonb, jsonb, jsonb, jsonb, jsonb, text, text, jsonb
) to anon, authenticated;

-- ===========================================================================
-- 6. Drop the AI profile analysis
-- ===========================================================================
drop function if exists public.start_creator_analysis(uuid, text, text, text, text);
drop function if exists public.complete_creator_analysis(uuid, jsonb);
drop function if exists public.fail_creator_analysis(uuid, text, text);
drop function if exists public.analysis_stats();
-- Only the /app/ai page read this.
drop function if exists public.evidence_stats();

-- The view selects the cache columns; rebuild it first (CRM list + has_address).
drop view if exists public.application_list_items;

alter table public.applications
  drop column if exists current_analysis_id,
  drop column if exists current_score,
  drop column if exists current_tier,
  drop column if exists analysis_status,
  drop column if exists analysis_confidence,
  drop column if exists analysis_coverage;

drop table if exists public.creator_analyses;

-- Score/tier history lived in these events' payloads.
delete from public.creator_events
 where type in ('analysis_completed', 'analysis_failed');

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
  tt.followers_declared   as tiktok_followers,
  exists (
    select 1 from public.creator_addresses ca
    where ca.organization_id = a.organization_id
      and ca.creator_id = a.creator_id
      and ca.is_current
  )                       as has_address
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

-- admin_get_organization — the 20260831000001 body without analyses_count.
create or replace function public.admin_get_organization(p_organization_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row jsonb;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;

  select jsonb_build_object(
    'id', o.id, 'name', o.name, 'slug', o.slug, 'subdomain', o.subdomain,
    'status', o.status, 'created_at', o.created_at,
    'plan_code', s.plan_code, 'started_at', s.started_at,
    'expires_at', s.expires_at, 'notes', s.notes,
    'logo_url', st.logo_url, 'favicon_url', st.favicon_url,
    'users_count', (select count(*) from public.organization_members m where m.organization_id = o.id),
    'creators_count', (select count(*) from public.creators c where c.organization_id = o.id),
    'programs_count', (select count(*) from public.programs pr where pr.organization_id = o.id),
    'applications_count', (select count(*) from public.applications a where a.organization_id = o.id),
    'shipments_count', (select count(*) from public.shipments sh where sh.organization_id = o.id),
    'pending_invites', (select count(*) from public.organization_invites i where i.organization_id = o.id and i.status = 'pending')
  )
  into v_row
  from public.organizations o
  left join public.organization_subscriptions s on s.organization_id = o.id
  left join public.organization_settings st on st.organization_id = o.id
  where o.id = p_organization_id;

  if v_row is null then raise exception 'ORGANIZATION_NOT_FOUND'; end if;
  return v_row;
end;
$$;

revoke all on function public.admin_get_organization(uuid) from public;
grant execute on function public.admin_get_organization(uuid) to authenticated;

alter table public.applications enable trigger applications_block_suspended;
