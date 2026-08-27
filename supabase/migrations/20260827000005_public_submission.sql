-- Creator Hub — Phase 1 public read + submission path.
--
-- The public form is unauthenticated. Instead of opening SELECT policies on
-- admin tables to `anon`, two SECURITY DEFINER functions expose exactly what a
-- visitor needs and nothing else. They are the ONLY privileged path — the app
-- never uses the service_role key for this.
--
-- Both:
--   * `set search_path = ''`  -> every app object is schema-qualified; a caller
--     cannot shadow a name to trick the definer-privileged body. pg_catalog
--     built-ins (jsonb_*, lower, now, gen_random_uuid, ...) still resolve.
--   * are scoped to a single (org slug, program slug); they cannot read or
--     write arbitrary tenant data.
--   * granted to `anon` and `authenticated` only.

-- ---------------------------------------------------------------------------
-- get_public_program(org_slug, program_slug) -> jsonb | null
--
-- Returns branding + public program copy + the ordered, active form fields.
-- Returns NULL for a missing program or one in status draft/archived (so those
-- stay invisible). A 'paused' program is returned WITH its status so the page
-- can show a "closed" message; only 'active' accepts submissions.
-- No internal UUIDs are included in the payload.
-- ---------------------------------------------------------------------------
create or replace function public.get_public_program(
  p_org_slug text,
  p_program_slug text
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p.id is null then null
    when p.status in ('draft', 'archived') then null
    else jsonb_build_object(
      'organization', jsonb_build_object(
        'name', o.name,
        'logo_url', s.logo_url,
        'primary_color', s.primary_color,
        'secondary_color', s.secondary_color
      ),
      'program', jsonb_build_object(
        'slug', p.slug,
        'status', p.status,
        'form_version', p.form_version,
        'public_title', coalesce(p.public_title, p.name),
        'public_description', p.public_description,
        'success_message', p.success_message
      ),
      'fields', coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'field_key', f.field_key,
            'label', f.label,
            'field_type', f.field_type,
            'placeholder', f.placeholder,
            'help_text', f.help_text,
            'required', f.required,
            'options', f.options,
            'configuration', f.configuration,
            'position', f.position
          ) order by f.position, f.created_at
        )
        from public.form_fields f
        where f.program_id = p.id and f.active
      ), '[]'::jsonb)
    )
  end
  from public.organizations o
  join public.programs p on p.organization_id = o.id and p.slug = p_program_slug
  left join public.organization_settings s on s.organization_id = o.id
  where o.slug = p_org_slug;
$$;

revoke all on function public.get_public_program(text, text) from public;
grant execute on function public.get_public_program(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- submit_application(...) -> jsonb
--
-- One plpgsql body == one implicit transaction: any raise rolls the whole
-- thing back, so a failed submission never leaves an orphan creator/profile.
--
-- Steps: resolve program (must be 'active') -> advisory lock on the person's
-- primary identity within the org (serializes concurrent duplicate submits) ->
-- dedup by instagram / tiktok / email / phone (priority order) -> reuse or
-- create creator -> upsert social profiles (never reassigning a handle to
-- another creator) -> insert application (status 'new') -> log creator_event.
--
-- `possible_duplicate` is set when the identity signals point at more than one
-- existing creator; nothing is merged.
-- ---------------------------------------------------------------------------
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
  v_primary_id   uuid;
  v_matched      uuid[] := '{}';
  v_tmp          uuid;
  v_possible_dup boolean := false;
  v_app_id       uuid;
  s              jsonb;
  v_full_name    text := nullif(btrim(p_creator->>'full_name'), '');
  v_email        text := nullif(lower(btrim(p_creator->>'email')), '');
  v_phone        text := nullif(btrim(p_creator->>'phone_e164'), '');
  v_ig           text := nullif((
                    select x->>'handle_normalized'
                    from jsonb_array_elements(coalesce(p_socials, '[]'::jsonb)) x
                    where x->>'platform' = 'instagram'
                      and nullif(x->>'handle_normalized', '') is not null
                    limit 1), '');
  v_tt           text := nullif((
                    select x->>'handle_normalized'
                    from jsonb_array_elements(coalesce(p_socials, '[]'::jsonb)) x
                    where x->>'platform' = 'tiktok'
                      and nullif(x->>'handle_normalized', '') is not null
                    limit 1), '');
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

  -- Serialize concurrent submissions of the same person in this org.
  v_lock_key := coalesce(v_ig, v_tt, v_email, v_phone, gen_random_uuid()::text);
  perform pg_advisory_xact_lock(hashtext(v_org_id::text || '|' || v_lock_key));

  -- Dedup, priority: instagram -> tiktok -> email -> phone.
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

  if v_phone is not null then
    select id into v_tmp from public.creators
    where organization_id = v_org_id and phone_e164 = v_phone
      and archived_at is null limit 1;
    if v_tmp is not null then
      v_primary_id := coalesce(v_primary_id, v_tmp);
      if not (v_tmp = any (v_matched)) then v_matched := v_matched || v_tmp; end if;
    end if;
  end if;

  if array_length(v_matched, 1) is null then
    if v_full_name is null then
      raise exception 'MISSING_NAME';
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
