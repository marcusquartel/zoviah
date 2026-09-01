-- Zoviah — Supabase Storage bucket for organization brand images.
--
-- Platform admins upload a tenant's logo from /admin instead of pasting a URL.
-- The bucket is public-read (logos render on the login page and public forms,
-- which are unauthenticated); writes are restricted to platform admins.
-- `organization_settings.logo_url` still stores the resolved public URL — this
-- only adds a place to host the file.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'org-branding', 'org-branding', true,
  1048576, array['image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read (the bucket is public, but be explicit for the RLS layer).
drop policy if exists "org-branding public read" on storage.objects;
create policy "org-branding public read"
  on storage.objects for select
  using (bucket_id = 'org-branding');

-- Writes: platform admins only.
drop policy if exists "org-branding admin write" on storage.objects;
create policy "org-branding admin write"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'org-branding' and public.is_platform_admin());

drop policy if exists "org-branding admin update" on storage.objects;
create policy "org-branding admin update"
  on storage.objects for update to authenticated
  using (bucket_id = 'org-branding' and public.is_platform_admin())
  with check (bucket_id = 'org-branding' and public.is_platform_admin());

drop policy if exists "org-branding admin delete" on storage.objects;
create policy "org-branding admin delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'org-branding' and public.is_platform_admin());
