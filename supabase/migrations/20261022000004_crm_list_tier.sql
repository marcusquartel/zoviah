-- Zoviah — CRM list shows and filters by the creator's categoria (tier).
-- Same view as 20260906000001 with tier_id / tier_name appended (create or
-- replace may only add columns at the end).

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
  exists (
    select 1 from public.creator_addresses ca
    where ca.organization_id = a.organization_id
      and ca.creator_id = a.creator_id
      and ca.is_current
  )                       as has_address,
  c.tier_id               as tier_id,
  t.name                  as tier_name
from public.applications a
join public.programs p on p.id = a.program_id
join public.creators c on c.id = a.creator_id
left join public.creator_tiers t on t.id = c.tier_id
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
