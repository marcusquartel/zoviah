-- Creator Hub — Phase 7A: go-live hardening.
--
-- Three additions, no feature work:
--   1. Invite-only signup: an anon RPC that hands the server the invite's
--      real e-mail (only for a still-valid invite) so a brand-new user can
--      create their own account from the invite page — killing the manual
--      "Supabase Dashboard -> Add user" step.
--   2. A durable (DB-backed) rate limit for the public application form, so
--      the throttle survives serverless instance churn. IP is stored hashed.
--   3. Platform-admin branding: set an organization's logo / favicon URL from
--      /admin instead of a hand-written UPDATE.
--
-- No earlier migration is edited.

-- ===========================================================================
-- 1. Invite-only signup support
-- ===========================================================================

-- prepare_invite_signup — called by the signup server action (anon). Returns
-- the invite's e-mail ONLY when the invite can still be accepted: pending,
-- not expired, not revoked, and the organization is active. The caller must
-- already hold the secret token (sha256 in `p_token_hash`), so revealing the
-- e-mail to that holder is acceptable — it is the address the invite was sent
-- to. The page itself keeps showing the masked form via get_public_org_invite.
create or replace function public.prepare_invite_signup(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.organization_invites%rowtype;
  v_org_name text;
  v_org_status text;
begin
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into v_inv from public.organization_invites
  where token_hash = p_token_hash for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  if v_inv.status = 'pending' and v_inv.expires_at < now() then
    update public.organization_invites set status = 'expired', updated_at = now()
    where id = v_inv.id;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if v_inv.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', v_inv.status);
  end if;

  select name, status into v_org_name, v_org_status
  from public.organizations where id = v_inv.organization_id;
  if v_org_status = 'suspended' then
    return jsonb_build_object('ok', false, 'reason', 'organization_suspended');
  end if;

  return jsonb_build_object(
    'ok', true,
    'email', lower(v_inv.email),
    'organization_name', v_org_name,
    'role', v_inv.role
  );
end;
$$;

revoke all on function public.prepare_invite_signup(text) from public;
grant execute on function public.prepare_invite_signup(text) to anon, authenticated;

-- ===========================================================================
-- 2. Durable public-submission rate limit
-- ===========================================================================

-- One fixed-window counter per (hashed IP). Rows are swept opportunistically
-- by the function itself; a stale row is at most one window old.
create table public.public_submission_throttle (
  ip_hash      text primary key,
  window_start timestamptz not null default now(),
  count        integer not null default 0
);

alter table public.public_submission_throttle enable row level security;
-- No policy: only the SECURITY DEFINER function below ever touches it.

-- rate_limit_public_submission — atomic check-and-increment. Returns
-- {allowed: bool, retry_after: int}. `p_ip_hash` is a sha256 hex the caller
-- computes from the client IP (raw IP is never sent to the DB).
create or replace function public.rate_limit_public_submission(
  p_ip_hash text,
  p_max int default 8,
  p_window_secs int default 600
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := now();
  v_window interval := make_interval(secs => greatest(coalesce(p_window_secs, 600), 30));
  v_max int := greatest(coalesce(p_max, 8), 1);
  v_row public.public_submission_throttle%rowtype;
begin
  if p_ip_hash is null or char_length(p_ip_hash) <> 64 then
    -- Unusable key -> fail open but cheaply (no row written).
    return jsonb_build_object('allowed', true, 'retry_after', 0);
  end if;

  -- Opportunistic sweep so the table cannot grow without bound.
  delete from public.public_submission_throttle
  where window_start < v_now - v_window - interval '1 hour';

  insert into public.public_submission_throttle (ip_hash, window_start, count)
  values (p_ip_hash, v_now, 1)
  on conflict (ip_hash) do update
    set count = case
          when public.public_submission_throttle.window_start < v_now - v_window
            then 1
          else public.public_submission_throttle.count + 1
        end,
        window_start = case
          when public.public_submission_throttle.window_start < v_now - v_window
            then v_now
          else public.public_submission_throttle.window_start
        end
  returning * into v_row;

  if v_row.count > v_max then
    return jsonb_build_object(
      'allowed', false,
      'retry_after', ceil(extract(epoch from (v_row.window_start + v_window - v_now)))::int
    );
  end if;

  return jsonb_build_object('allowed', true, 'retry_after', 0);
end;
$$;

revoke all on function public.rate_limit_public_submission(text, int, int) from public;
grant execute on function public.rate_limit_public_submission(text, int, int) to anon, authenticated;

-- ===========================================================================
-- 3. Platform-admin branding
-- ===========================================================================

create or replace function public.admin_set_organization_branding(
  p_organization_id uuid,
  p_logo_url text,
  p_favicon_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_logo text := nullif(btrim(coalesce(p_logo_url, '')), '');
  v_favicon text := nullif(btrim(coalesce(p_favicon_url, '')), '');
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'ORGANIZATION_NOT_FOUND';
  end if;
  -- Only http(s) absolute URLs. No javascript:/data:/relative.
  if v_logo is not null and v_logo !~* '^https?://[^\s]+$' then
    raise exception 'INVALID_LOGO_URL';
  end if;
  if v_favicon is not null and v_favicon !~* '^https?://[^\s]+$' then
    raise exception 'INVALID_FAVICON_URL';
  end if;

  update public.organization_settings
  set logo_url = v_logo, favicon_url = v_favicon
  where organization_id = p_organization_id;

  insert into public.platform_audit_events (actor_user_id, organization_id, event_type, metadata)
  values (v_uid, p_organization_id, 'organization_branding_updated',
    jsonb_build_object('logo_set', v_logo is not null, 'favicon_set', v_favicon is not null));

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_set_organization_branding(uuid, text, text) from public;
grant execute on function public.admin_set_organization_branding(uuid, text, text) to authenticated;

-- admin_get_organization — re-created to also return the current branding URLs
-- so the /admin editor can prefill them. Body is otherwise unchanged.
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
    'id', o.id, 'name', o.name, 'slug', o.slug, 'status', o.status,
    'created_at', o.created_at,
    'plan_code', s.plan_code, 'started_at', s.started_at,
    'expires_at', s.expires_at, 'notes', s.notes,
    'logo_url', st.logo_url, 'favicon_url', st.favicon_url,
    'users_count', (select count(*) from public.organization_members m where m.organization_id = o.id),
    'creators_count', (select count(*) from public.creators c where c.organization_id = o.id),
    'programs_count', (select count(*) from public.programs pr where pr.organization_id = o.id),
    'applications_count', (select count(*) from public.applications a where a.organization_id = o.id),
    'analyses_count', (select count(*) from public.creator_analyses an where an.organization_id = o.id),
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
