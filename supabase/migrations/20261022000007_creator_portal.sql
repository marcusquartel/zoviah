-- Zoviah — creator portal: a creator logs in (e-mail + password) and sees her
-- own performance, coupons, commissions and the brand's monthly ranking.
--
-- Access model
--   * A creator is NOT an organization member. creator_portal_users links an
--     auth user to a creator record; every portal read goes through the
--     SECURITY DEFINER RPCs below, which resolve the creator from auth.uid().
--     No RLS policy grants a portal user access to org tables.
--   * Staff invite a creator (token by e-mail, hash stored only). The invite
--     is bound to the creator's e-mail; accepting requires a session whose
--     e-mail matches (same pattern as organization_invites).
--
-- Ranking (decided with the brand): month-to-date paid sales value, overall
-- and within her categoria. Others are shown by name + position only; values
-- are returned for the caller alone.

-- ===========================================================================
-- Tables
-- ===========================================================================
create table public.creator_portal_users (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  creator_id      uuid not null unique references public.creators (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  created_at      timestamptz not null default now()
);
create index creator_portal_users_user_idx on public.creator_portal_users (user_id);

alter table public.creator_portal_users enable row level security;
create policy creator_portal_users_select_member
  on public.creator_portal_users for select to authenticated
  using (public.is_organization_member(organization_id));

create table public.creator_portal_invites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  creator_id      uuid not null references public.creators (id) on delete cascade,
  email           text not null check (char_length(email) between 3 and 254),
  token_hash      text not null unique check (char_length(token_hash) = 64),
  status          text not null default 'pending'
                  check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at      timestamptz not null,
  accepted_at     timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index creator_portal_invites_creator_idx
  on public.creator_portal_invites (creator_id, status);

alter table public.creator_portal_invites enable row level security;
create policy creator_portal_invites_select_member
  on public.creator_portal_invites for select to authenticated
  using (public.is_organization_member(organization_id));

-- ===========================================================================
-- Staff: invite / revoke
-- ===========================================================================
create or replace function public.create_creator_portal_invite(
  p_creator_id uuid, p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_c     public.creators%rowtype;
  v_org   text;
  v_actor text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_token_hash is null or char_length(p_token_hash) <> 64 then raise exception 'INVALID_PAYLOAD'; end if;
  select * into v_c from public.creators where id = p_creator_id;
  if v_c.id is null or v_c.archived_at is not null then raise exception 'CREATOR_NOT_FOUND'; end if;
  if not public.is_organization_admin(v_c.organization_id) then raise exception 'FORBIDDEN'; end if;
  if nullif(btrim(v_c.email), '') is null then raise exception 'CREATOR_WITHOUT_EMAIL'; end if;

  update public.creator_portal_invites set status = 'revoked', updated_at = now()
  where creator_id = p_creator_id and status = 'pending';

  insert into public.creator_portal_invites
    (organization_id, creator_id, email, token_hash, expires_at, created_by)
  values
    (v_c.organization_id, p_creator_id, lower(btrim(v_c.email)), p_token_hash,
     now() + interval '14 days', v_uid);

  select name into v_org from public.organizations where id = v_c.organization_id;
  select email into v_actor from auth.users where id = v_uid;
  insert into public.creator_events (organization_id, creator_id, type, actor_user_id, data)
  values (v_c.organization_id, p_creator_id, 'portal_invited', v_uid,
          jsonb_build_object('actor_email', v_actor));

  return jsonb_build_object(
    'email', lower(btrim(v_c.email)),
    'creator_name', coalesce(nullif(btrim(v_c.preferred_name), ''), split_part(v_c.full_name, ' ', 1)),
    'organization_name', v_org
  );
end;
$$;
revoke all on function public.create_creator_portal_invite(uuid, text) from public;
grant execute on function public.create_creator_portal_invite(uuid, text) to authenticated;

create or replace function public.revoke_creator_portal_access(p_creator_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_org uuid;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select organization_id into v_org from public.creators where id = p_creator_id;
  if v_org is null then raise exception 'CREATOR_NOT_FOUND'; end if;
  if not public.is_organization_admin(v_org) then raise exception 'FORBIDDEN'; end if;
  delete from public.creator_portal_users where creator_id = p_creator_id;
  update public.creator_portal_invites set status = 'revoked', updated_at = now()
  where creator_id = p_creator_id and status = 'pending';
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.revoke_creator_portal_access(uuid) from public;
grant execute on function public.revoke_creator_portal_access(uuid) to authenticated;

-- ===========================================================================
-- Invite page (anon) / signup / accept
-- ===========================================================================
create or replace function public.get_creator_portal_invite(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.creator_portal_invites%rowtype;
  v_org text;
  v_name text;
begin
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    return jsonb_build_object('status', 'invalid');
  end if;
  select * into v_inv from public.creator_portal_invites where token_hash = p_token_hash;
  if not found then return jsonb_build_object('status', 'invalid'); end if;
  if v_inv.status = 'pending' and v_inv.expires_at < now() then
    update public.creator_portal_invites set status = 'expired', updated_at = now() where id = v_inv.id;
    v_inv.status := 'expired';
  end if;
  if v_inv.status in ('revoked', 'expired') then
    return jsonb_build_object('status', 'invalid');
  end if;
  select name into v_org from public.organizations where id = v_inv.organization_id;
  select coalesce(nullif(btrim(preferred_name), ''), split_part(full_name, ' ', 1)) into v_name
  from public.creators where id = v_inv.creator_id;
  return jsonb_build_object(
    'status', v_inv.status,
    'organization_name', v_org,
    'creator_name', v_name,
    'email_masked', regexp_replace(v_inv.email, '^(..).*(@.*)$', '\1***\2')
  );
end;
$$;
revoke all on function public.get_creator_portal_invite(text) from public;
grant execute on function public.get_creator_portal_invite(text) to anon, authenticated;

-- The e-mail to sign up with comes from the invite, never from the browser.
create or replace function public.prepare_creator_portal_signup(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_inv public.creator_portal_invites%rowtype;
begin
  if p_token_hash is null or char_length(p_token_hash) <> 64 then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;
  select * into v_inv from public.creator_portal_invites where token_hash = p_token_hash for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'invalid'); end if;
  if v_inv.status = 'pending' and v_inv.expires_at < now() then
    update public.creator_portal_invites set status = 'expired', updated_at = now() where id = v_inv.id;
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;
  if v_inv.status <> 'pending' then
    return jsonb_build_object('ok', false, 'reason', v_inv.status);
  end if;
  return jsonb_build_object('ok', true, 'email', v_inv.email);
end;
$$;
revoke all on function public.prepare_creator_portal_signup(text) from public;
grant execute on function public.prepare_creator_portal_signup(text) to anon, authenticated;

create or replace function public.accept_creator_portal_invite(p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_email text;
  v_inv   public.creator_portal_invites%rowtype;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_token_hash is null or char_length(p_token_hash) <> 64 then raise exception 'INVALID_INVITE'; end if;
  select * into v_inv from public.creator_portal_invites where token_hash = p_token_hash for update;
  if not found then raise exception 'INVALID_INVITE'; end if;
  if v_inv.status = 'pending' and v_inv.expires_at < now() then
    update public.creator_portal_invites set status = 'expired', updated_at = now() where id = v_inv.id;
    raise exception 'INVALID_INVITE';
  end if;

  select lower(email) into v_email from auth.users where id = v_uid;
  if v_email is null or v_email <> lower(v_inv.email) then raise exception 'EMAIL_MISMATCH'; end if;

  if v_inv.status = 'accepted' then
    if exists (select 1 from public.creator_portal_users where creator_id = v_inv.creator_id and user_id = v_uid) then
      return jsonb_build_object('status', 'already_active');
    end if;
    raise exception 'INVALID_INVITE';
  end if;
  if v_inv.status <> 'pending' then raise exception 'INVALID_INVITE'; end if;

  -- A re-invite (e.g. after an e-mail change) moves the access to this user.
  insert into public.creator_portal_users (organization_id, creator_id, user_id)
  values (v_inv.organization_id, v_inv.creator_id, v_uid)
  on conflict (creator_id) do update set user_id = excluded.user_id, created_at = now();

  update public.creator_portal_invites
  set status = 'accepted', accepted_at = now(), updated_at = now()
  where id = v_inv.id;

  insert into public.creator_events (organization_id, creator_id, type, actor_user_id, data)
  values (v_inv.organization_id, v_inv.creator_id, 'portal_joined', v_uid, '{}'::jsonb);

  return jsonb_build_object('status', 'accepted');
end;
$$;
revoke all on function public.accept_creator_portal_invite(text) from public;
grant execute on function public.accept_creator_portal_invite(text) to authenticated;

-- ===========================================================================
-- Portal reads
-- ===========================================================================
create or replace function public.portal_my_creators()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'creator_id', c.id,
    'creator_name', coalesce(nullif(btrim(c.preferred_name), ''), c.full_name),
    'organization_name', o.name
  ) order by o.name), '[]'::jsonb)
  from public.creator_portal_users pu
  join public.creators c on c.id = pu.creator_id and c.archived_at is null
  join public.organizations o on o.id = pu.organization_id and o.status <> 'suspended'
  where pu.user_id = (select auth.uid());
$$;
revoke all on function public.portal_my_creators() from public;
grant execute on function public.portal_my_creators() to authenticated;

-- Month-to-date paid sales per participating creator (active affiliate code),
-- ranked. Internal: never granted to clients.
create or replace function public.portal_ranking(p_org uuid, p_tier uuid, p_from timestamptz)
returns table (creator_id uuid, display_name text, tier_name text, orders bigint, sales numeric, rank_position bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with participants as (
    select c.id, coalesce(nullif(btrim(c.preferred_name), ''), c.full_name) as display_name,
           t.name as tier_name
    from public.creators c
    join public.creator_affiliations ca
      on ca.creator_id = c.id and ca.organization_id = p_org and ca.active
    left join public.creator_tiers t on t.id = c.tier_id
    where c.organization_id = p_org and c.archived_at is null
      and (p_tier is null or c.tier_id = p_tier)
  ), totals as (
    select p.id, p.display_name, p.tier_name,
           count(o.id) as orders, coalesce(sum(o.subtotal), 0) as sales
    from participants p
    left join public.shopify_orders o
      on o.creator_id = p.id and o.organization_id = p_org
     and not o.test and o.cancelled_at is null
     and upper(coalesce(o.financial_status, '')) in ('PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED')
     and o.processed_at >= p_from
    group by p.id, p.display_name, p.tier_name
  )
  select id, display_name, tier_name, orders, sales,
         rank() over (order by sales desc, orders desc) as rank_position
  from totals
  order by sales desc, orders desc, display_name;
$$;
revoke all on function public.portal_ranking(uuid, uuid, timestamptz) from public, anon, authenticated;

create or replace function public.portal_dashboard(p_creator_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_c      public.creators%rowtype;
  v_org    public.organizations%rowtype;
  v_tier   public.creator_tiers%rowtype;
  v_aff    public.creator_affiliations%rowtype;
  v_pers   public.creator_personal_coupons%rowtype;
  v_month  timestamptz := (date_trunc('month', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
  v_rank_all  jsonb;
  v_rank_tier jsonb;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (
    select 1 from public.creator_portal_users
    where creator_id = p_creator_id and user_id = v_uid
  ) then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_c from public.creators where id = p_creator_id and archived_at is null;
  if v_c.id is null then raise exception 'FORBIDDEN'; end if;
  select * into v_org from public.organizations where id = v_c.organization_id;
  if v_org.status = 'suspended' then raise exception 'FORBIDDEN'; end if;
  select * into v_tier from public.creator_tiers where id = v_c.tier_id;
  select * into v_aff from public.creator_affiliations
   where organization_id = v_c.organization_id and creator_id = v_c.id;
  select * into v_pers from public.creator_personal_coupons
   where organization_id = v_c.organization_id and creator_id = v_c.id;

  -- Ranking rows: name + position for everyone, numbers only for her.
  select coalesce(jsonb_agg(jsonb_build_object(
           'position', r.rank_position, 'name', r.display_name, 'tier', r.tier_name,
           'me', r.creator_id = v_c.id,
           'sales', case when r.creator_id = v_c.id then r.sales end,
           'orders', case when r.creator_id = v_c.id then r.orders end
         ) order by r.rank_position, r.display_name), '[]'::jsonb)
    into v_rank_all
    from public.portal_ranking(v_c.organization_id, null, v_month) r;

  if v_c.tier_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
             'position', r.rank_position, 'name', r.display_name, 'tier', r.tier_name,
             'me', r.creator_id = v_c.id,
             'sales', case when r.creator_id = v_c.id then r.sales end,
             'orders', case when r.creator_id = v_c.id then r.orders end
           ) order by r.rank_position, r.display_name), '[]'::jsonb)
      into v_rank_tier
      from public.portal_ranking(v_c.organization_id, v_c.tier_id, v_month) r;
  end if;

  return jsonb_build_object(
    'creator', jsonb_build_object(
      'name', coalesce(nullif(btrim(v_c.preferred_name), ''), split_part(v_c.full_name, ' ', 1)),
      'full_name', v_c.full_name),
    'organization', jsonb_build_object('name', v_org.name),
    'tier', case when v_tier.id is null then null
                 else jsonb_build_object('name', v_tier.name, 'commission_rate', v_tier.commission_rate,
                                         'description', v_tier.description) end,
    'commission_rate', public.creator_commission_rate(v_c.organization_id, v_c.id),
    'coupons', jsonb_build_object(
      'affiliate', case when v_aff.id is null then null
                        else jsonb_build_object('code', v_aff.code, 'discount_percent', v_aff.discount_percent,
                                                'active', v_aff.active) end,
      'personal', case when v_pers.id is null then null
                       else jsonb_build_object('code', v_pers.code, 'discount_percent', v_pers.discount_percent) end),
    'month', (
      select jsonb_build_object(
        'from', v_month,
        'orders', count(o.id),
        'sales', coalesce(sum(o.subtotal), 0),
        'commission', coalesce(sum(cm.amount) filter (where cm.status <> 'reversed'), 0))
      from public.shopify_orders o
      left join public.commissions cm on cm.order_id = o.id
      where o.creator_id = v_c.id and not o.test and o.cancelled_at is null
        and upper(coalesce(o.financial_status, '')) in ('PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED')
        and o.processed_at >= v_month),
    'commissions', (
      select jsonb_build_object(
        'awaiting_payment', coalesce(sum(amount) filter (where status = 'awaiting_payment'), 0),
        'in_hold', coalesce(sum(amount) filter (where status = 'pending' and approvable_at > now()), 0),
        'available', coalesce(sum(amount) filter (where status = 'pending' and approvable_at <= now()), 0),
        'paid', coalesce(sum(amount) filter (where status = 'paid'), 0))
      from public.commissions where creator_id = v_c.id and organization_id = v_c.organization_id),
    'recent_orders', (
      select coalesce(jsonb_agg(x order by x->>'processed_at' desc), '[]'::jsonb) from (
        select jsonb_build_object(
          'name', o.name, 'processed_at', o.processed_at, 'subtotal', o.subtotal,
          'currency', o.currency, 'cancelled', o.cancelled_at is not null,
          'commission', cm.amount,
          'commission_status', case
            when cm.id is null then null
            when cm.status = 'pending' and cm.approvable_at <= now() then 'available'
            when cm.status = 'pending' then 'in_hold'
            else cm.status end) as x
        from public.shopify_orders o
        left join public.commissions cm on cm.order_id = o.id
        where o.creator_id = v_c.id and not o.test
        order by o.processed_at desc
        limit 15) s),
    'ranking', jsonb_build_object('all', v_rank_all, 'tier', v_rank_tier)
  );
end;
$$;
revoke all on function public.portal_dashboard(uuid) from public;
grant execute on function public.portal_dashboard(uuid) to authenticated;
