-- Creator Hub — DEV seed: "Rare Creators" program for the Rare Way tenant.
--
-- Demonstrates that the form builder can produce the Rare Creators form with
-- NO code changes — every field here is a normal form_fields row.
--
-- Safe to re-run: upserts the program by (organization_id, slug) and each
-- field by (program_id, field_key). The program is left as `draft` — activate
-- it from /app/programs when you want the public URL to accept submissions.
--
-- Run in the Supabase SQL Editor (needs the Rare Way org from bootstrap.sql).
-- Do NOT run against production.

do $$
declare
  v_org_id     uuid;
  v_program_id uuid;
begin
  select id into v_org_id from public.organizations where slug = 'rare-way';
  if v_org_id is null then
    raise exception 'Rare Way organization not found — run supabase/bootstrap.sql first.';
  end if;

  insert into public.programs (
    organization_id, name, slug, status,
    public_title, public_description, success_message
  ) values (
    v_org_id, 'Rare Creators', 'creators', 'draft',
    'Seja uma Rare Creator',
    'Preencha o formulário abaixo para se candidatar ao nosso programa de creators.',
    'Recebemos sua inscrição! Nosso time vai avaliar e entrar em contato.'
  )
  on conflict (organization_id, slug) do update
    set name = excluded.name
  returning id into v_program_id;

  -- Replace the field set wholesale so re-runs converge.
  delete from public.form_fields where program_id = v_program_id;

  insert into public.form_fields
    (organization_id, program_id, field_key, label, field_type, required,
     position, configuration, options, placeholder)
  values
    (v_org_id, v_program_id, 'full_name', 'Nome completo', 'text', true, 0,
     '{"mapping":"full_name"}', null, null),
    (v_org_id, v_program_id, 'preferred_name', 'Nome pelo qual prefere ser chamada', 'text', false, 1,
     '{"mapping":"preferred_name"}', null, null),
    (v_org_id, v_program_id, 'birth_date', 'Data de nascimento', 'date', false, 2,
     '{"mapping":"birth_date"}', null, null),
    (v_org_id, v_program_id, 'email', 'E-mail', 'email', true, 3,
     '{"mapping":"email"}', null, 'voce@email.com'),
    (v_org_id, v_program_id, 'whatsapp', 'WhatsApp', 'phone', true, 4,
     '{"mapping":"phone"}', null, '(11) 90000-0000'),
    (v_org_id, v_program_id, 'city', 'Cidade', 'text', false, 5,
     '{"mapping":"city"}', null, null),
    (v_org_id, v_program_id, 'state', 'Estado', 'text', false, 6,
     '{"mapping":"state"}', null, 'UF'),
    (v_org_id, v_program_id, 'instagram', 'Instagram', 'instagram', true, 7,
     '{}', null, '@seu.usuario'),
    (v_org_id, v_program_id, 'instagram_followers', 'Seguidores aproximados no Instagram', 'number', false, 8,
     '{"mapping":"instagram_followers"}', null, null),
    (v_org_id, v_program_id, 'tiktok', 'TikTok', 'tiktok', false, 9,
     '{}', null, '@seu.usuario'),
    (v_org_id, v_program_id, 'tiktok_followers', 'Seguidores aproximados no TikTok', 'number', false, 10,
     '{"mapping":"tiktok_followers"}', null, null),
    (v_org_id, v_program_id, 'content_topics', 'Assuntos sobre os quais produz conteúdo', 'text', false, 11,
     '{}', null, 'beleza, skincare, lifestyle…'),
    (v_org_id, v_program_id, 'content_link_1', 'Link de conteúdo 1', 'url', false, 12, '{}', null, null),
    (v_org_id, v_program_id, 'content_link_2', 'Link de conteúdo 2', 'url', false, 13, '{}', null, null),
    (v_org_id, v_program_id, 'content_link_3', 'Link de conteúdo 3', 'url', false, 14, '{}', null, null),
    (v_org_id, v_program_id, 'worked_with_brands', 'Já trabalhou com marcas?', 'single_select', false, 15,
     '{}', '[{"value":"sim","label":"Sim"},{"value":"nao","label":"Não"}]', null),
    (v_org_id, v_program_id, 'which_brands', 'Quais marcas?', 'textarea', false, 16, '{}', null, null),
    (v_org_id, v_program_id, 'how_work_with_brands', 'Como costuma trabalhar com marcas?', 'textarea', false, 17, '{}', null, null),
    (v_org_id, v_program_id, 'has_media_kit', 'Possui mídia kit?', 'single_select', false, 18,
     '{}', '[{"value":"sim","label":"Sim"},{"value":"nao","label":"Não"}]', null);

  update public.programs set form_version = form_version + 1 where id = v_program_id;

  raise notice 'Seeded program % (Rare Creators / creators) with 19 fields', v_program_id;
end
$$;
