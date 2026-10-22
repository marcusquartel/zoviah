-- Zoviah — staff can edit a creator's record from the CRM modal.
--
-- 1. update_creator_profile: cadastro fields + Instagram / TikTok in one
--    atomic call. Only keys present in the payload are touched; the event
--    records WHICH fields changed, never their values (no PII in events).
-- 2. set_creator_address_manual: staff types the shipping address + CPF
--    (data received by WhatsApp, a spreadsheet…). It becomes the current
--    address exactly like a signup / secure-link one, with source 'manual'.
--
-- Both are SECURITY DEFINER, owner/admin of the creator's organization only.

-- ===========================================================================
-- creator_addresses — allow a staff-entered source
-- ===========================================================================
alter table public.creator_addresses
  drop constraint if exists creator_addresses_source_check;
alter table public.creator_addresses
  add constraint creator_addresses_source_check
  check (
    (source = 'secure_request' and source_request_id is not null)
    or (source in ('signup', 'manual') and source_request_id is null)
  );

-- ===========================================================================
-- 1. update_creator_profile
-- ===========================================================================
create or replace function public.update_creator_profile(
  p_creator_id uuid,
  p_payload    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_org      uuid;
  v_actor    text;
  v_old      public.creators%rowtype;
  v_changed  text[] := '{}';
  v_name     text;
  v_email    text;
  v_phone    text;
  v_birth    date;
  v_platform text;
  s          jsonb;
  v_handle   text;
  v_display  text;
  v_follow   bigint;
  v_owner    uuid;
  v_prof_id  uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 4000 then
    raise exception 'INVALID_PAYLOAD';
  end if;

  select * into v_old from public.creators where id = p_creator_id;
  if v_old.id is null then
    raise exception 'CREATOR_NOT_FOUND';
  end if;
  v_org := v_old.organization_id;
  if not public.is_organization_admin(v_org) then
    raise exception 'FORBIDDEN';
  end if;

  -- ---- scalar fields (only keys present in the payload) -------------------
  if p_payload ? 'full_name' then
    v_name := nullif(btrim(p_payload->>'full_name'), '');
    if v_name is null or char_length(v_name) > 150 then
      raise exception 'INVALID_NAME';
    end if;
  end if;

  if p_payload ? 'email' then
    v_email := nullif(lower(btrim(p_payload->>'email')), '');
    if v_email is not null then
      if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
        raise exception 'INVALID_EMAIL';
      end if;
      if exists (
        select 1 from public.creators
        where organization_id = v_org and lower(email) = v_email
          and id <> p_creator_id and archived_at is null
      ) then
        raise exception 'EMAIL_TAKEN';
      end if;
    end if;
  end if;

  if p_payload ? 'phone_e164' then
    v_phone := nullif(btrim(p_payload->>'phone_e164'), '');
    if v_phone is not null and v_phone !~ '^\+[0-9]{11,15}$' then
      raise exception 'INVALID_PHONE';
    end if;
  end if;

  if p_payload ? 'birth_date' and nullif(p_payload->>'birth_date', '') is not null then
    if p_payload->>'birth_date' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'INVALID_BIRTH_DATE';
    end if;
    begin
      v_birth := (p_payload->>'birth_date')::date;
    exception when others then
      raise exception 'INVALID_BIRTH_DATE';
    end;
    if v_birth > current_date or v_birth < date '1900-01-01' then
      raise exception 'INVALID_BIRTH_DATE';
    end if;
  end if;

  if char_length(coalesce(p_payload->>'preferred_name', '')) > 120
     or char_length(coalesce(p_payload->>'city', '')) > 120
     or (nullif(btrim(p_payload->>'state'), '') is not null
         and upper(btrim(p_payload->>'state')) !~ '^[A-Z]{2}$')
     or (nullif(p_payload->>'postal_code', '') is not null
         and regexp_replace(p_payload->>'postal_code', '[^0-9]', '', 'g') !~ '^[0-9]{8}$') then
    raise exception 'INVALID_PAYLOAD';
  end if;

  update public.creators c set
    full_name      = case when p_payload ? 'full_name' then v_name else c.full_name end,
    preferred_name = case when p_payload ? 'preferred_name'
                          then nullif(btrim(p_payload->>'preferred_name'), '') else c.preferred_name end,
    email          = case when p_payload ? 'email' then v_email else c.email end,
    phone_e164     = case when p_payload ? 'phone_e164' then v_phone else c.phone_e164 end,
    birth_date     = case when p_payload ? 'birth_date' then v_birth else c.birth_date end,
    city           = case when p_payload ? 'city'
                          then nullif(btrim(p_payload->>'city'), '') else c.city end,
    state          = case when p_payload ? 'state'
                          then nullif(upper(btrim(p_payload->>'state')), '') else c.state end,
    postal_code    = case when p_payload ? 'postal_code'
                          then nullif(regexp_replace(p_payload->>'postal_code', '[^0-9]', '', 'g'), '')
                          else c.postal_code end,
    updated_at     = now()
  where c.id = p_creator_id;

  select array_agg(k) into v_changed
  from (
    select 'full_name' k where p_payload ? 'full_name' and v_name is distinct from v_old.full_name
    union all select 'preferred_name' where p_payload ? 'preferred_name'
      and nullif(btrim(p_payload->>'preferred_name'), '') is distinct from v_old.preferred_name
    union all select 'email' where p_payload ? 'email' and v_email is distinct from v_old.email
    union all select 'phone' where p_payload ? 'phone_e164' and v_phone is distinct from v_old.phone_e164
    union all select 'birth_date' where p_payload ? 'birth_date' and v_birth is distinct from v_old.birth_date
    union all select 'city' where p_payload ? 'city'
      and nullif(btrim(p_payload->>'city'), '') is distinct from v_old.city
    union all select 'state' where p_payload ? 'state'
      and nullif(upper(btrim(p_payload->>'state')), '') is distinct from v_old.state
    union all select 'postal_code' where p_payload ? 'postal_code'
      and nullif(regexp_replace(p_payload->>'postal_code', '[^0-9]', '', 'g'), '') is distinct from v_old.postal_code
  ) x;
  v_changed := coalesce(v_changed, '{}');

  -- ---- socials: { "instagram": {handle, handle_normalized, followers}, ... }
  -- An empty handle leaves the existing profile alone (removing a profile
  -- would drop its metric history).
  foreach v_platform in array array['instagram', 'tiktok'] loop
    s := p_payload->'socials'->v_platform;
    if s is null or jsonb_typeof(s) <> 'object' then
      continue;
    end if;
    v_handle  := nullif(btrim(s->>'handle_normalized'), '');
    v_display := coalesce(nullif(btrim(s->>'handle'), ''), v_handle);
    if nullif(s->>'followers', '') is not null then
      if s->>'followers' !~ '^[0-9]{1,15}$' then
        raise exception 'INVALID_PAYLOAD';
      end if;
      v_follow := (s->>'followers')::bigint;
    else
      v_follow := null;
    end if;
    if v_handle is null then
      continue;
    end if;
    if char_length(v_handle) > 120 or char_length(v_display) > 120 then
      raise exception 'INVALID_PAYLOAD';
    end if;

    select creator_id into v_owner from public.creator_social_profiles
    where organization_id = v_org and platform = v_platform
      and handle_normalized = v_handle;
    if v_owner is not null and v_owner <> p_creator_id then
      raise exception 'HANDLE_TAKEN';
    end if;

    select id into v_prof_id from public.creator_social_profiles
    where organization_id = v_org and creator_id = p_creator_id
      and platform = v_platform
    order by (handle_normalized = v_handle) desc, created_at
    limit 1;

    if v_prof_id is null then
      insert into public.creator_social_profiles (
        organization_id, creator_id, platform, handle, handle_normalized,
        profile_url, followers_declared
      ) values (
        v_org, p_creator_id, v_platform, v_display, v_handle, null, v_follow
      );
      v_changed := v_changed || v_platform;
    else
      update public.creator_social_profiles set
        handle             = v_display,
        handle_normalized  = v_handle,
        followers_declared = v_follow,
        updated_at         = now()
      where id = v_prof_id
        and (handle_normalized is distinct from v_handle
             or followers_declared is distinct from v_follow);
      if found then
        v_changed := v_changed || v_platform;
      end if;
    end if;
    v_prof_id := null;
    v_owner := null;
  end loop;

  if array_length(v_changed, 1) is not null then
    select email into v_actor from auth.users where id = v_uid;
    insert into public.creator_events
      (organization_id, creator_id, type, actor_user_id, data)
    values (
      v_org, p_creator_id, 'creator_updated', v_uid,
      jsonb_build_object('fields', to_jsonb(v_changed), 'actor_email', v_actor)
    );
  end if;

  return jsonb_build_object('ok', true, 'changed', to_jsonb(v_changed));
end;
$$;

revoke all on function public.update_creator_profile(uuid, jsonb) from public;
grant execute on function public.update_creator_profile(uuid, jsonb) to authenticated;

-- ===========================================================================
-- 2. set_creator_address_manual
-- ===========================================================================
create or replace function public.set_creator_address_manual(
  p_creator_id uuid,
  p_payload    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := (select auth.uid());
  v_org          uuid;
  v_name         text;
  v_actor        text;
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
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or octet_length(p_payload::text) > 2000 then
    raise exception 'INVALID_ADDRESS';
  end if;

  select organization_id, full_name into v_org, v_name
  from public.creators where id = p_creator_id;
  if v_org is null then
    raise exception 'CREATOR_NOT_FOUND';
  end if;
  if not public.is_organization_admin(v_org) then
    raise exception 'FORBIDDEN';
  end if;

  v_cpf          := regexp_replace(coalesce(p_payload->>'cpf', ''), '[^0-9]', '', 'g');
  v_postal       := regexp_replace(coalesce(p_payload->>'postal_code', ''), '[^0-9]', '', 'g');
  v_street       := btrim(coalesce(p_payload->>'street', ''));
  v_number       := btrim(coalesce(p_payload->>'number', ''));
  v_complement   := nullif(btrim(coalesce(p_payload->>'complement', '')), '');
  v_neighborhood := btrim(coalesce(p_payload->>'neighborhood', ''));
  v_city         := btrim(coalesce(p_payload->>'city', ''));
  v_state        := upper(btrim(coalesce(p_payload->>'state', '')));
  v_recipient    := coalesce(nullif(btrim(coalesce(p_payload->>'recipient_name', '')), ''), v_name);

  if v_street = '' or v_number = '' or v_neighborhood = '' or v_city = ''
     or char_length(v_postal) <> 8 or v_state !~ '^[A-Z]{2}$'
     or not public.is_valid_cpf(v_cpf) then
    raise exception 'INVALID_ADDRESS';
  end if;
  if char_length(v_street) > 200 or char_length(v_number) > 50
     or char_length(v_neighborhood) > 150 or char_length(v_city) > 150
     or char_length(v_recipient) > 150
     or (v_complement is not null and char_length(v_complement) > 150) then
    raise exception 'INVALID_ADDRESS';
  end if;

  update public.creator_addresses set is_current = false, updated_at = now()
  where organization_id = v_org and creator_id = p_creator_id and is_current;

  insert into public.creator_addresses (
    organization_id, creator_id, recipient_name, cpf, postal_code, street,
    number, complement, neighborhood, city, state, country,
    source, source_request_id, is_current
  ) values (
    v_org, p_creator_id, v_recipient, v_cpf, v_postal, v_street,
    v_number, v_complement, v_neighborhood, v_city, v_state, 'BR',
    'manual', null, true
  );

  -- Keep the creator's location columns in step with the shipping address.
  update public.creators set
    city = v_city, state = v_state, postal_code = v_postal, updated_at = now()
  where id = p_creator_id;

  -- No PII in events.
  select email into v_actor from auth.users where id = v_uid;
  insert into public.creator_events
    (organization_id, creator_id, type, actor_user_id, data)
  values (
    v_org, p_creator_id, 'address_submitted', v_uid,
    jsonb_build_object('source', 'manual', 'actor_email', v_actor)
  );

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.set_creator_address_manual(uuid, jsonb) from public;
grant execute on function public.set_creator_address_manual(uuid, jsonb) to authenticated;
