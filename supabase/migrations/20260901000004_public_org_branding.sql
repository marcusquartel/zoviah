-- Zoviah — public branding lookup by tenant subdomain.
--
-- The login page has no authenticated session, so it cannot resolve the org
-- through RLS. This SECURITY DEFINER function exposes ONLY the white-label
-- branding (name, logo, colours) for an active org at `<subdomain>.zoviah.app`,
-- so the login screen (and any other pre-auth page on a tenant host) can show
-- the tenant's identity. No PII, no counts, no settings beyond branding.

create or replace function public.get_public_org_branding(p_subdomain text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'name', o.name,
    'logo_url', s.logo_url,
    'primary_color', s.primary_color,
    'secondary_color', s.secondary_color
  )
  from public.organizations o
  left join public.organization_settings s on s.organization_id = o.id
  where o.subdomain = lower(btrim(coalesce(p_subdomain, '')))
    and o.subdomain is not null
    and o.status = 'active'
  limit 1;
$$;

revoke all on function public.get_public_org_branding(text) from public;
grant execute on function public.get_public_org_branding(text) to anon, authenticated;
