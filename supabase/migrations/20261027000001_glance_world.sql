-- Zoviah — GLANCE WORLD: the creator game, server side.
--
-- The rules live in the database so nobody can wear what she did not earn by
-- calling the API directly:
--   * creator_game_stats(creator)  → her numbers (sales, content, tier, …)
--   * game_achievements(stats)     → achievement ids she has unlocked
--   * game_catalog()               → item → slot → required achievement
--     (generated from src/lib/game/catalog.ts; tests/game-catalog.test.ts
--     keeps both lists identical)
--   * game_sanitize_avatar()       → drops anything locked / unknown
-- Achievement thresholds mirror ACHIEVEMENTS in the same TS file.
--
-- Social: interactions (clap / heart / wave) and collected hennas are stored
-- (rate-limited) and feed two achievements. Live presence / movement go
-- through a private Realtime channel per brand, "glance-world:<org_id>",
-- readable and writable only by that brand's portal creators and members.
-- Achievements with a real prize are recorded once and logged on the
-- creator's timeline for the staff to deliver.

-- ===========================================================================
-- Tables
-- ===========================================================================
create table public.creator_game_profiles (
  creator_id        uuid primary key references public.creators (id) on delete cascade,
  organization_id   uuid not null references public.organizations (id) on delete cascade,
  avatar            jsonb not null default '{}'::jsonb
                    check (jsonb_typeof(avatar) = 'object' and octet_length(avatar::text) <= 2000),
  hennas_collected  integer not null default 0 check (hennas_collected >= 0),
  seen_achievements text[] not null default '{}',
  updated_at        timestamptz not null default now()
);
alter table public.creator_game_profiles enable row level security;
create policy creator_game_profiles_select_member
  on public.creator_game_profiles for select to authenticated
  using (public.is_organization_member(organization_id));

create table public.creator_interactions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  from_creator    uuid not null references public.creators (id) on delete cascade,
  to_creator      uuid not null references public.creators (id) on delete cascade,
  kind            text not null check (kind in ('clap', 'heart', 'wave')),
  created_at      timestamptz not null default now(),
  constraint creator_interactions_not_self check (from_creator <> to_creator)
);
create index creator_interactions_to_idx on public.creator_interactions (to_creator, created_at desc);
alter table public.creator_interactions enable row level security;
create policy creator_interactions_select_member
  on public.creator_interactions for select to authenticated
  using (public.is_organization_member(organization_id));

create table public.creator_game_prizes (
  creator_id      uuid not null references public.creators (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  achievement_id  text not null,
  unlocked_at     timestamptz not null default now(),
  delivered_at    timestamptz,
  primary key (creator_id, achievement_id)
);
alter table public.creator_game_prizes enable row level security;
create policy creator_game_prizes_select_member
  on public.creator_game_prizes for select to authenticated
  using (public.is_organization_member(organization_id));

-- ===========================================================================
-- Catalog (generated from src/lib/game/catalog.ts)
-- ===========================================================================
create or replace function public.game_catalog()
returns table (item_id text, slot text, achievement_id text)
language sql
immutable
set search_path = ''
as $$
  select * from (values
    ('skin-1', 'skin', null),
    ('skin-2', 'skin', null),
    ('skin-3', 'skin', null),
    ('skin-4', 'skin', null),
    ('skin-5', 'skin', null),
    ('skin-6', 'skin', null),
    ('hair-short', 'hair', null),
    ('hair-bob', 'hair', null),
    ('hair-long', 'hair', null),
    ('hair-curly', 'hair', null),
    ('hair-ponytail', 'hair', null),
    ('hair-bun', 'hair', 'stories12'),
    ('hc-black', 'hairColor', null),
    ('hc-brown', 'hairColor', null),
    ('hc-red', 'hairColor', null),
    ('hc-blond', 'hairColor', null),
    ('hc-pink', 'hairColor', 'sales1k'),
    ('hc-lilac', 'hairColor', 'tierRara'),
    ('top-tee', 'top', null),
    ('top-tee-black', 'top', null),
    ('top-rareway', 'top', 'first'),
    ('top-coat', 'top', 'content1'),
    ('top-poderosa', 'top', 'tierPoderosa'),
    ('bottom-black', 'bottom', null),
    ('bottom-jeans', 'bottom', null),
    ('bottom-lilac', 'bottom', null),
    ('bottom-turq', 'bottom', 'streak3'),
    ('head-none', 'head', null),
    ('head-band', 'head', 'five'),
    ('head-glasses', 'head', 'sales5k'),
    ('head-crown', 'head', 'champion'),
    ('back-none', 'back', null),
    ('back-wings', 'back', 'sales25'),
    ('back-cape', 'back', 'streak6'),
    ('back-backpack', 'back', 'collector'),
    ('pet-none', 'pet', null),
    ('pet-cat', 'pet', 'content10'),
    ('pet-bunny', 'pet', 'sales10k'),
    ('fx-none', 'effect', null),
    ('fx-sparkle', 'effect', 'ten'),
    ('fx-aura-turq', 'effect', 'streak3'),
    ('fx-aura-rara', 'effect', 'tierRara'),
    ('title-none', 'title', null),
    ('title-seller', 'title', 'sales1k'),
    ('title-podium', 'title', 'podium'),
    ('title-queen', 'title', 'champion'),
    ('title-legend', 'title', 'orders100'),
    ('title-loved', 'title', 'loved')
  ) as c(item_id, slot, achievement_id);
$$;

-- ===========================================================================
-- Stats + achievements
-- ===========================================================================
create or replace function public.creator_sales_streak(p_creator_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month  timestamptz := (date_trunc('month', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
  v_m      timestamptz := v_month;
  v_streak integer := 0;
begin
  if not exists (
    select 1 from public.shopify_orders o
    where o.creator_id = p_creator_id and not o.test and o.cancelled_at is null
      and upper(coalesce(o.financial_status, '')) in ('PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED')
      and o.processed_at >= v_m
  ) then
    v_m := (date_trunc('month', (v_month - interval '1 day') at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
  end if;
  while v_streak < 24 and exists (
    select 1 from public.shopify_orders o
    where o.creator_id = p_creator_id and not o.test and o.cancelled_at is null
      and upper(coalesce(o.financial_status, '')) in ('PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED')
      and o.processed_at >= v_m
      and o.processed_at < (date_trunc('month', (v_m + interval '32 days') at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo'
  ) loop
    v_streak := v_streak + 1;
    v_m := (date_trunc('month', (v_m - interval '1 day') at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
  end loop;
  return v_streak;
end;
$$;
revoke all on function public.creator_sales_streak(uuid) from public, anon, authenticated;

-- Same shape as GameStats in src/lib/game/catalog.ts.
create or replace function public.creator_game_stats(p_creator_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_c       public.creators%rowtype;
  v_month   timestamptz := (date_trunc('month', now() at time zone 'America/Sao_Paulo')) at time zone 'America/Sao_Paulo';
  v_day0    date := (date_trunc('month', now() at time zone 'America/Sao_Paulo'))::date;
  v_m_ord   bigint;
  v_m_sales numeric;
  v_t_ord   bigint;
  v_pos     bigint;
  v_level   bigint;
begin
  select * into v_c from public.creators where id = p_creator_id;
  if v_c.id is null then return null; end if;

  select count(*), coalesce(sum(subtotal), 0) into v_m_ord, v_m_sales
  from public.shopify_orders o
  where o.creator_id = v_c.id and not o.test and o.cancelled_at is null
    and upper(coalesce(o.financial_status, '')) in ('PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED')
    and o.processed_at >= v_month;

  select count(*) into v_t_ord
  from public.shopify_orders o
  where o.creator_id = v_c.id and not o.test and o.cancelled_at is null
    and upper(coalesce(o.financial_status, '')) in ('PAID', 'PARTIALLY_PAID', 'PARTIALLY_REFUNDED');

  if v_m_ord > 0 then
    select r.rank_position into v_pos
    from public.portal_ranking(v_c.organization_id, null, v_month) r where r.creator_id = v_c.id;
  end if;

  select t.lvl into v_level from (
    select id, row_number() over (order by position, name) as lvl
    from public.creator_tiers where organization_id = v_c.organization_id
  ) t where t.id = v_c.tier_id;

  return jsonb_build_object(
    'monthOrders', v_m_ord,
    'monthSales', v_m_sales,
    'totalOrders', v_t_ord,
    'position', v_pos,
    'streakMonths', public.creator_sales_streak(v_c.id),
    'monthContent', (select count(*) from public.creator_content
                     where creator_id = v_c.id and status = 'approved' and posted_on >= v_day0),
    'monthStories', (select count(*) from public.creator_content
                     where creator_id = v_c.id and status = 'approved' and format = 'story' and posted_on >= v_day0),
    'totalContent', (select count(*) from public.creator_content where creator_id = v_c.id and status = 'approved'),
    'tierLevel', v_level,
    'interactionsReceived', (select count(*) from public.creator_interactions where to_creator = v_c.id),
    'hennasCollected', coalesce((select hennas_collected from public.creator_game_profiles where creator_id = v_c.id), 0)
  );
end;
$$;
revoke all on function public.creator_game_stats(uuid) from public, anon, authenticated;

-- Mirrors ACHIEVEMENTS (thresholds) in src/lib/game/catalog.ts.
create or replace function public.game_achievements(s jsonb)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select array_remove(array[
    case when (s->>'totalOrders')::numeric >= 1 then 'first' end,
    case when (s->>'monthOrders')::numeric >= 5 then 'five' end,
    case when (s->>'monthOrders')::numeric >= 10 then 'ten' end,
    case when (s->>'monthOrders')::numeric >= 25 then 'sales25' end,
    case when (s->>'monthSales')::numeric >= 1000 then 'sales1k' end,
    case when (s->>'monthSales')::numeric >= 5000 then 'sales5k' end,
    case when (s->>'monthSales')::numeric >= 10000 then 'sales10k' end,
    case when (s->>'position')::numeric <= 3 then 'podium' end,
    case when (s->>'position')::numeric = 1 then 'champion' end,
    case when (s->>'streakMonths')::numeric >= 3 then 'streak3' end,
    case when (s->>'streakMonths')::numeric >= 6 then 'streak6' end,
    case when (s->>'totalOrders')::numeric >= 100 then 'orders100' end,
    case when (s->>'totalContent')::numeric >= 1 then 'content1' end,
    case when (s->>'monthContent')::numeric >= 10 then 'content10' end,
    case when (s->>'monthStories')::numeric >= 12 then 'stories12' end,
    case when coalesce((s->>'tierLevel')::numeric, 0) >= 2 then 'tierPoderosa' end,
    case when coalesce((s->>'tierLevel')::numeric, 0) >= 3 then 'tierRara' end,
    case when (s->>'interactionsReceived')::numeric >= 50 then 'loved' end,
    case when (s->>'hennasCollected')::numeric >= 100 then 'collector' end
  ], null);
$$;

-- Keep only known items, in their own slot, that are free or unlocked.
create or replace function public.game_sanitize_avatar(p_avatar jsonb, p_unlocked text[])
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(c.slot, c.item_id), '{}'::jsonb)
  from jsonb_each_text(case when jsonb_typeof(p_avatar) = 'object' then p_avatar else '{}'::jsonb end) kv
  join public.game_catalog() c on c.item_id = kv.value and c.slot = kv.key
  where c.achievement_id is null or c.achievement_id = any (p_unlocked);
$$;

-- Access: the creator herself (portal) or an owner/admin of her brand.
create or replace function public.game_can_access(p_creator_id uuid, p_admin_ok boolean)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_org uuid;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select organization_id into v_org from public.creators where id = p_creator_id and archived_at is null;
  if v_org is null then raise exception 'FORBIDDEN'; end if;
  if exists (select 1 from public.creator_portal_users where creator_id = p_creator_id and user_id = (select auth.uid())) then
    return v_org;
  end if;
  if p_admin_ok and public.is_organization_admin(v_org) then return v_org; end if;
  raise exception 'FORBIDDEN';
end;
$$;
revoke all on function public.game_can_access(uuid, boolean) from public, anon, authenticated;

-- ===========================================================================
-- RPCs
-- ===========================================================================
create or replace function public.portal_game(p_creator_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org      uuid := public.game_can_access(p_creator_id, true);
  v_stats    jsonb := public.creator_game_stats(p_creator_id);
  v_unlocked text[] := public.game_achievements(v_stats);
  v_profile  public.creator_game_profiles%rowtype;
  v_actor    text;
  a          text;
begin
  select * into v_profile from public.creator_game_profiles where creator_id = p_creator_id;

  -- Real prizes: recorded once, logged for the staff to deliver.
  foreach a in array array['sales10k', 'champion', 'orders100'] loop
    if a = any (v_unlocked) then
      insert into public.creator_game_prizes (creator_id, organization_id, achievement_id)
      values (p_creator_id, v_org, a)
      on conflict do nothing;
      if found then
        insert into public.creator_events (organization_id, creator_id, type, data)
        values (v_org, p_creator_id, 'game_prize_unlocked', jsonb_build_object('achievement', a));
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'organization_id', v_org,
    'stats', v_stats,
    'unlocked', to_jsonb(v_unlocked),
    'seen', to_jsonb(coalesce(v_profile.seen_achievements, '{}')),
    'avatar', public.game_sanitize_avatar(coalesce(v_profile.avatar, '{}'::jsonb), v_unlocked),
    'players', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id,
        'name', coalesce(nullif(btrim(c.preferred_name), ''), split_part(c.full_name, ' ', 1)),
        'tier', t.name,
        'position', (public.creator_game_stats(c.id)->>'position')::int,
        'avatar', public.game_sanitize_avatar(
                    coalesce(gp.avatar, '{}'::jsonb),
                    public.game_achievements(public.creator_game_stats(c.id))),
        'me', c.id = p_creator_id
      ) order by c.full_name), '[]'::jsonb)
      from public.creator_portal_users pu
      join public.creators c on c.id = pu.creator_id and c.archived_at is null
      left join public.creator_tiers t on t.id = c.tier_id
      left join public.creator_game_profiles gp on gp.creator_id = c.id
      where pu.organization_id = v_org
    )
  );
end;
$$;
revoke all on function public.portal_game(uuid) from public;
grant execute on function public.portal_game(uuid) to authenticated;

create or replace function public.portal_save_avatar(p_creator_id uuid, p_avatar jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org   uuid := public.game_can_access(p_creator_id, false);
  v_clean jsonb := public.game_sanitize_avatar(p_avatar, public.game_achievements(public.creator_game_stats(p_creator_id)));
begin
  insert into public.creator_game_profiles (creator_id, organization_id, avatar, updated_at)
  values (p_creator_id, v_org, v_clean, now())
  on conflict (creator_id) do update set avatar = excluded.avatar, updated_at = now();
  return v_clean;
end;
$$;
revoke all on function public.portal_save_avatar(uuid, jsonb) from public;
grant execute on function public.portal_save_avatar(uuid, jsonb) to authenticated;

create or replace function public.portal_game_seen(p_creator_id uuid, p_ids text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_org uuid := public.game_can_access(p_creator_id, false);
begin
  insert into public.creator_game_profiles (creator_id, organization_id, seen_achievements)
  values (p_creator_id, v_org, coalesce(p_ids, '{}'))
  on conflict (creator_id) do update set
    seen_achievements = (select array(select distinct unnest(public.creator_game_profiles.seen_achievements || coalesce(p_ids, '{}')))),
    updated_at = now();
end;
$$;
revoke all on function public.portal_game_seen(uuid, text[]) from public;
grant execute on function public.portal_game_seen(uuid, text[]) to authenticated;

create or replace function public.portal_interact(p_from uuid, p_to uuid, p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_org uuid := public.game_can_access(p_from, false);
begin
  if p_kind not in ('clap', 'heart', 'wave') then raise exception 'INVALID_PAYLOAD'; end if;
  if p_from = p_to then raise exception 'INVALID_PAYLOAD'; end if;
  if not exists (select 1 from public.creator_portal_users where creator_id = p_to and organization_id = v_org) then
    raise exception 'FORBIDDEN';
  end if;
  if not public.bump_rate_bucket('gw:int:' || p_from::text, 30, 60) then raise exception 'RATE_LIMITED'; end if;
  insert into public.creator_interactions (organization_id, from_creator, to_creator, kind)
  values (v_org, p_from, p_to, p_kind);
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.portal_interact(uuid, uuid, text) from public;
grant execute on function public.portal_interact(uuid, uuid, text) to authenticated;

create or replace function public.portal_collect_hennas(p_creator_id uuid, p_count integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid := public.game_can_access(p_creator_id, false);
  v_n   integer;
begin
  if p_count is null or p_count < 1 or p_count > 10 then raise exception 'INVALID_PAYLOAD'; end if;
  if not public.bump_rate_bucket('gw:henna:' || p_creator_id::text, 20, 60) then raise exception 'RATE_LIMITED'; end if;
  insert into public.creator_game_profiles (creator_id, organization_id, hennas_collected)
  values (p_creator_id, v_org, p_count)
  on conflict (creator_id) do update set hennas_collected = public.creator_game_profiles.hennas_collected + p_count, updated_at = now()
  returning hennas_collected into v_n;
  return v_n;
end;
$$;
revoke all on function public.portal_collect_hennas(uuid, integer) from public;
grant execute on function public.portal_collect_hennas(uuid, integer) to authenticated;

-- ===========================================================================
-- Realtime: private channel "glance-world:<org_id>"
-- ===========================================================================
create or replace function public.can_join_glance_world(p_topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_topic like 'glance-world:%'
    and (
      exists (
        select 1 from public.creator_portal_users pu
        where pu.user_id = (select auth.uid())
          and pu.organization_id::text = split_part(p_topic, ':', 2)
      )
      or exists (
        select 1 from public.organization_members m
        where m.user_id = (select auth.uid())
          and m.organization_id::text = split_part(p_topic, ':', 2)
      )
    );
$$;
revoke all on function public.can_join_glance_world(text) from public, anon;
grant execute on function public.can_join_glance_world(text) to authenticated;

drop policy if exists "glance world read" on realtime.messages;
create policy "glance world read"
  on realtime.messages for select to authenticated
  using (public.can_join_glance_world((select realtime.topic())));

drop policy if exists "glance world write" on realtime.messages;
create policy "glance world write"
  on realtime.messages for insert to authenticated
  with check (public.can_join_glance_world((select realtime.topic())));
