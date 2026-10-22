-- Zoviah — Rare Way programs: "Creators" and "Embaixadoras Glance".
--
-- Every field is a normal form_fields row (no code changes). The public form
-- always appends the fixed shipping-address block (CEP, endereço, CPF), so the
-- Estado / Cidade fields below are hidden there and only used by manual entry
-- and spreadsheet import.
--
-- Safe to re-run: upserts each program by (organization_id, slug) and replaces
-- its field set. Both programs are published as `active`.
--
-- Run: npm run db:sql -- -f supabase/seed_rare_way_programs.sql

do $$
declare
  v_org_id     uuid;
  v_program_id uuid;
  yes_no constant jsonb := '[{"value":"sim","label":"Sim"},{"value":"nao","label":"Não"}]';
begin
  select id into v_org_id from public.organizations where slug = 'rare-way';
  if v_org_id is null then
    raise exception 'Rare Way organization not found.';
  end if;

  -- -------------------------------------------------------------------------
  -- Creators — cadastro de possíveis creators da marca
  -- -------------------------------------------------------------------------
  insert into public.programs (
    organization_id, name, slug, status, description,
    public_title, public_description, success_message
  ) values (
    v_org_id, 'Creators', 'creators', 'active',
    'Cadastro de possíveis creators da marca.',
    'Seja uma Rare Creator',
    'Preencha o formulário abaixo para se candidatar ao programa de creators da Rare Way.',
    'Recebemos sua inscrição! Nosso time vai avaliar seu perfil e entrar em contato.'
  )
  on conflict (organization_id, slug) do update
    set name = excluded.name,
        status = excluded.status,
        description = excluded.description,
        public_title = excluded.public_title,
        public_description = excluded.public_description,
        success_message = excluded.success_message,
        archived_at = null
  returning id into v_program_id;

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
    (v_org_id, v_program_id, 'state', 'Estado', 'br_state', false, 5,
     '{"mapping":"state"}', null, null),
    (v_org_id, v_program_id, 'city', 'Cidade', 'br_city', false, 6,
     '{"mapping":"city"}', null, null),
    (v_org_id, v_program_id, 'instagram', 'Instagram', 'instagram', true, 7,
     '{"mapping":"instagram"}', null, '@seu.usuario'),
    (v_org_id, v_program_id, 'instagram_followers', 'Seguidores aproximados no Instagram', 'number', false, 8,
     '{"mapping":"instagram_followers"}', null, null),
    (v_org_id, v_program_id, 'tiktok', 'TikTok', 'tiktok', false, 9,
     '{"mapping":"tiktok"}', null, '@seu.usuario'),
    (v_org_id, v_program_id, 'tiktok_followers', 'Seguidores aproximados no TikTok', 'number', false, 10,
     '{"mapping":"tiktok_followers"}', null, null),
    (v_org_id, v_program_id, 'content_topics', 'Assuntos sobre os quais produz conteúdo', 'text', false, 11,
     '{}', null, 'beleza, maquiagem, skincare, lifestyle…'),
    (v_org_id, v_program_id, 'content_link_1', 'Link de conteúdo 1', 'url', false, 12, '{}', null, null),
    (v_org_id, v_program_id, 'content_link_2', 'Link de conteúdo 2', 'url', false, 13, '{}', null, null),
    (v_org_id, v_program_id, 'content_link_3', 'Link de conteúdo 3', 'url', false, 14, '{}', null, null),
    (v_org_id, v_program_id, 'worked_with_brands', 'Já trabalhou com marcas?', 'single_select', false, 15,
     '{}', yes_no, null),
    (v_org_id, v_program_id, 'which_brands', 'Quais marcas?', 'textarea', false, 16, '{}', null, null),
    (v_org_id, v_program_id, 'has_media_kit', 'Possui mídia kit?', 'single_select', false, 17,
     '{}', yes_no, null),
    (v_org_id, v_program_id, 'why_rare', 'Por que você quer ser uma Rare Creator?', 'textarea', false, 18,
     '{}', null, null);

  update public.programs set form_version = form_version + 1 where id = v_program_id;
  raise notice 'Program Creators: %', v_program_id;

  -- -------------------------------------------------------------------------
  -- Embaixadoras Glance — profissionais de sobrancelhas
  -- -------------------------------------------------------------------------
  insert into public.programs (
    organization_id, name, slug, status, description,
    public_title, public_description, success_message
  ) values (
    v_org_id, 'Embaixadoras Glance', 'embaixadoras-glance', 'active',
    'Profissionais de sobrancelhas que querem ser embaixadoras da marca Glance.',
    'Seja uma Embaixadora Glance',
    'Você é profissional de sobrancelhas e quer representar a Glance? Preencha o formulário abaixo para se candidatar ao programa de embaixadoras.',
    'Recebemos sua inscrição! Nosso time vai conhecer seu trabalho e entrar em contato.'
  )
  on conflict (organization_id, slug) do update
    set name = excluded.name,
        status = excluded.status,
        description = excluded.description,
        public_title = excluded.public_title,
        public_description = excluded.public_description,
        success_message = excluded.success_message,
        archived_at = null
  returning id into v_program_id;

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
    (v_org_id, v_program_id, 'state', 'Estado', 'br_state', false, 5,
     '{"mapping":"state"}', null, null),
    (v_org_id, v_program_id, 'city', 'Cidade', 'br_city', false, 6,
     '{"mapping":"city"}', null, null),
    (v_org_id, v_program_id, 'instagram', 'Instagram profissional', 'instagram', true, 7,
     '{"mapping":"instagram"}', null, '@seu.studio'),
    (v_org_id, v_program_id, 'instagram_followers', 'Seguidores aproximados no Instagram', 'number', false, 8,
     '{"mapping":"instagram_followers"}', null, null),
    (v_org_id, v_program_id, 'tiktok', 'TikTok', 'tiktok', false, 9,
     '{"mapping":"tiktok"}', null, '@seu.usuario'),
    (v_org_id, v_program_id, 'services', 'Quais serviços você realiza?', 'multi_select', true, 10,
     '{}',
     '[{"value":"design","label":"Design de sobrancelhas"},
       {"value":"henna","label":"Design com henna"},
       {"value":"brow_lamination","label":"Brow lamination"},
       {"value":"micropigmentacao","label":"Micropigmentação"},
       {"value":"cilios","label":"Cílios (extensão / lash lifting)"},
       {"value":"outro","label":"Outro"}]',
     null),
    (v_org_id, v_program_id, 'experience_years', 'Há quanto tempo atua como profissional de sobrancelhas?', 'single_select', true, 11,
     '{}',
     '[{"value":"menos_1","label":"Menos de 1 ano"},
       {"value":"1_3","label":"De 1 a 3 anos"},
       {"value":"3_5","label":"De 3 a 5 anos"},
       {"value":"mais_5","label":"Mais de 5 anos"}]',
     null),
    (v_org_id, v_program_id, 'workplace', 'Onde você atende?', 'single_select', true, 12,
     '{}',
     '[{"value":"studio_proprio","label":"Studio / espaço próprio"},
       {"value":"salao","label":"Salão de beleza"},
       {"value":"clinica","label":"Clínica de estética"},
       {"value":"domicilio","label":"Atendimento a domicílio"},
       {"value":"outro","label":"Outro"}]',
     null),
    (v_org_id, v_program_id, 'studio_name', 'Nome do studio / espaço', 'text', false, 13, '{}', null, null),
    (v_org_id, v_program_id, 'monthly_clients', 'Quantas clientes atende por mês, aproximadamente?', 'single_select', false, 14,
     '{}',
     '[{"value":"ate_30","label":"Até 30"},
       {"value":"30_80","label":"De 30 a 80"},
       {"value":"80_150","label":"De 80 a 150"},
       {"value":"mais_150","label":"Mais de 150"}]',
     null),
    (v_org_id, v_program_id, 'uses_glance', 'Você já usa produtos Glance?', 'single_select', true, 15,
     '{}',
     '[{"value":"uso","label":"Sim, já uso"},
       {"value":"conheco","label":"Conheço, mas ainda não uso"},
       {"value":"nao_conheco","label":"Ainda não conheço"}]',
     null),
    (v_org_id, v_program_id, 'glance_products', 'Quais produtos Glance você usa?', 'textarea', false, 16, '{}', null, null),
    (v_org_id, v_program_id, 'teaches', 'Você dá cursos ou treinamentos para outras profissionais?', 'single_select', false, 17,
     '{}', yes_no, null),
    (v_org_id, v_program_id, 'portfolio_link', 'Link do seu portfólio ou de um trabalho seu', 'url', false, 18, '{}', null, null),
    (v_org_id, v_program_id, 'why_ambassador', 'Por que você quer ser uma Embaixadora Glance?', 'textarea', true, 19,
     '{}', null, null);

  update public.programs set form_version = form_version + 1 where id = v_program_id;
  raise notice 'Program Embaixadoras Glance: %', v_program_id;
end
$$;
