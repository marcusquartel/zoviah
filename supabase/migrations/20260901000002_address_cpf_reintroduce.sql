-- Zoviah — reintroduce the recipient CPF on the shipping address.
--
-- CPF was added in 20260829000003 and then removed in 20260829000005 as
-- out-of-scope for Phase 4. It is now required again: the Correios shipping
-- label needs the recipient's CPF. This migration deliberately supersedes
-- 20260829000005 for the CPF column and the two functions that read it.
--
-- Same PII discipline as the original: CPF is stored digits-only on
-- creator_addresses, written only by complete_address_request, restored to the
-- shipment address snapshot, and never placed in creator_events, the CRM list,
-- logs, or any Claude payload.

-- ---------------------------------------------------------------------------
-- is_valid_cpf(text) — structural CPF check (11 digits, not a repeated digit,
-- both check digits correct). IMMUTABLE so a CHECK constraint can use it.
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_cpf(p_cpf text)
returns boolean
language plpgsql
immutable
as $$
declare
  d   int[];
  i   int;
  s   int;
  c1  int;
  c2  int;
begin
  if p_cpf is null or p_cpf !~ '^[0-9]{11}$' then
    return false;
  end if;
  if p_cpf ~ '^(.)\1{10}$' then
    return false;
  end if;

  d := array(select (regexp_split_to_table(p_cpf, ''))::int);

  s := 0;
  for i in 1..9 loop
    s := s + d[i] * (11 - i);
  end loop;
  c1 := (s * 10) % 11;
  if c1 = 10 then c1 := 0; end if;
  if c1 <> d[10] then
    return false;
  end if;

  s := 0;
  for i in 1..10 loop
    s := s + d[i] * (12 - i);
  end loop;
  c2 := (s * 10) % 11;
  if c2 = 10 then c2 := 0; end if;
  return c2 = d[11];
end;
$$;

-- ---------------------------------------------------------------------------
-- creator_addresses.cpf — digits only. Nullable at the DB level (old rows have
-- none); required by the RPC going forward.
-- ---------------------------------------------------------------------------
alter table public.creator_addresses
  add column if not exists cpf text;

alter table public.creator_addresses
  drop constraint if exists creator_addresses_cpf_check;
alter table public.creator_addresses
  add constraint creator_addresses_cpf_check
  check (cpf is null or public.is_valid_cpf(cpf));

-- ---------------------------------------------------------------------------
-- complete_address_request — normalize + require the CPF. Body is the current
-- 20260829000005 version plus the CPF handling from 20260829000003.
-- ---------------------------------------------------------------------------
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
    complement, neighborhood, city, state, country, source_request_id, is_current
  ) values (
    v_org, v_creator, v_recipient, v_cpf, v_postal, v_street, v_number,
    v_complement, v_neighborhood, v_city, v_state, 'BR', v_req.id, true
  )
  returning id into v_addr_id;

  update public.application_requests set
    status = 'completed', completed_at = now(), consent_at = now(), updated_at = now()
  where id = v_req.id;

  update public.applications set status = 'completed'
  where id = v_req.application_id;

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

-- ---------------------------------------------------------------------------
-- build_address_snapshot — re-add the cpf key (Phase 5 shipping helper). Body
-- is the 20260829000005 version plus 'cpf'.
-- ---------------------------------------------------------------------------
create or replace function public.build_address_snapshot(
  p_org uuid, p_creator uuid, out o_address_id uuid, out o_snapshot jsonb
)
language plpgsql
set search_path = ''
as $$
declare
  v_addr public.creator_addresses%rowtype;
begin
  select * into v_addr
  from public.creator_addresses
  where organization_id = p_org and creator_id = p_creator and is_current
  limit 1;

  if not found
     or coalesce(btrim(v_addr.recipient_name), '') = ''
     or v_addr.postal_code !~ '^[0-9]{8}$'
     or coalesce(btrim(v_addr.street), '') = ''
     or coalesce(btrim(v_addr.number), '') = ''
     or coalesce(btrim(v_addr.neighborhood), '') = ''
     or coalesce(btrim(v_addr.city), '') = ''
     or v_addr.state !~ '^[A-Z]{2}$' then
    raise exception 'NO_CURRENT_ADDRESS';
  end if;

  o_address_id := v_addr.id;
  o_snapshot := jsonb_build_object(
    'recipient_name', v_addr.recipient_name,
    'cpf',            v_addr.cpf,
    'postal_code',    v_addr.postal_code,
    'street',         v_addr.street,
    'number',         v_addr.number,
    'complement',     v_addr.complement,
    'neighborhood',   v_addr.neighborhood,
    'city',           v_addr.city,
    'state',          v_addr.state,
    'country',        v_addr.country
  );
end;
$$;
