-- Zoviah — optional landing page content per program.
--
-- programs.landing holds the sections rendered above the public form
-- (/p/<org>/<program>): hero, text blocks, benefit tiers, steps, closing
-- call-to-action. NULL = the plain form page as before. Shape is validated
-- in the app (src/features/public/landing/schema.ts); here only type + size.
-- Read publicly through get_public_program_landing, with the same visibility
-- as get_public_program (no draft / archived programs).

alter table public.programs
  add column landing jsonb
    check (landing is null or (jsonb_typeof(landing) = 'object' and octet_length(landing::text) <= 60000));

create or replace function public.get_public_program_landing(p_org_slug text, p_program_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select p.landing
  from public.programs p
  join public.organizations o on o.id = p.organization_id
  where o.slug = p_org_slug and p.slug = p_program_slug
    and p.status in ('active', 'paused')
    and o.status <> 'suspended';
$$;
revoke all on function public.get_public_program_landing(text, text) from public;
grant execute on function public.get_public_program_landing(text, text) to anon, authenticated;
