-- Creator Hub — Phase 6B (1/2): support system.
--
-- A knowledge base + an AI support assistant that answers ONLY from retrieved
-- articles, with feedback and escalation to a human ticket. The AI never runs
-- an operational RPC, never mutates tenant data, never reads PII (addresses,
-- tokens, snapshots). No earlier migration is edited.

-- ===========================================================================
-- 1. help_articles — platform-global knowledge (NOT tenant-scoped).
-- ===========================================================================
create table public.help_articles (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (char_length(category) between 1 and 60),
  title       text not null check (char_length(title) between 1 and 200),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  summary     text check (summary is null or char_length(summary) <= 500),
  content     text not null,
  keywords    text[] not null default '{}',
  status      text not null default 'draft'
                check (status in ('draft', 'published', 'archived')),
  -- Populated by trigger below (not a GENERATED column: a stored generated
  -- tsvector needs a strictly-immutable expression, and the weighted
  -- to_tsvector('portuguese', ...) form is only stable — Postgres rejects it
  -- at CREATE TABLE with "generation expression is not immutable").
  search_vector tsvector,
  created_by  uuid references auth.users (id) on delete set null,
  updated_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index help_articles_search_idx on public.help_articles using gin (search_vector);
create index help_articles_status_category_idx
  on public.help_articles (status, category);

-- Keep search_vector in sync with the weighted text fields.
create or replace function public.help_articles_tsv()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(new.summary, '')), 'B') ||
    setweight(to_tsvector('portuguese', array_to_string(new.keywords, ' ')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(new.content, '')), 'C');
  return new;
end;
$$;

create trigger help_articles_tsv_sync
  before insert or update of title, summary, keywords, content
  on public.help_articles
  for each row execute function public.help_articles_tsv();

create trigger help_articles_set_updated_at
  before update on public.help_articles
  for each row execute function public.set_updated_at();

alter table public.help_articles enable row level security;

-- Any authenticated user reads PUBLISHED articles. Writes: platform-admin RPC.
create policy help_articles_select_published
  on public.help_articles for select to authenticated
  using (status = 'published');

-- ===========================================================================
-- 2. support_conversations
-- ===========================================================================
create table public.support_conversations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  status          text not null default 'open'
                    check (status in ('open', 'resolved', 'escalated')),
  current_route   text,
  module          text,
  ai_resolved     boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  closed_at       timestamptz
);

create index support_conversations_user_idx
  on public.support_conversations (user_id, created_at desc);
create index support_conversations_org_status_idx
  on public.support_conversations (organization_id, status, created_at desc);

create trigger support_conversations_set_updated_at
  before update on public.support_conversations
  for each row execute function public.set_updated_at();

alter table public.support_conversations enable row level security;

-- The user sees / creates only their own conversations.
create policy support_conversations_select_own
  on public.support_conversations for select to authenticated
  using (user_id = (select auth.uid()));
create policy support_conversations_insert_own
  on public.support_conversations for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_organization_member(organization_id)
  );

-- ===========================================================================
-- 3. support_messages
-- ===========================================================================
create table public.support_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations (id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system_event')),
  content         text not null,
  article_refs    uuid[] not null default '{}',
  model           text,
  input_tokens    integer,
  output_tokens   integer,
  latency_ms      integer,
  created_at      timestamptz not null default now()
);

create index support_messages_conversation_idx
  on public.support_messages (conversation_id, created_at);

alter table public.support_messages enable row level security;

-- Read messages of your own conversations. Writes: RPC only.
create policy support_messages_select_own
  on public.support_messages for select to authenticated
  using (exists (
    select 1 from public.support_conversations c
    where c.id = conversation_id and c.user_id = (select auth.uid())
  ));

-- ===========================================================================
-- 4. support_tickets
-- ===========================================================================
create table public.support_tickets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  conversation_id uuid references public.support_conversations (id) on delete set null,
  user_id         uuid not null references auth.users (id) on delete cascade,
  type            text not null default 'question'
                    check (type in ('question', 'account', 'bug', 'feature_request', 'other')),
  status          text not null default 'open'
                    check (status in ('open', 'in_progress', 'resolved', 'closed')),
  priority        text not null default 'normal'
                    check (priority in ('low', 'normal', 'high', 'critical')),
  subject         text not null check (char_length(subject) between 1 and 200),
  description     text not null check (char_length(description) between 1 and 8000),
  current_route   text,
  module          text,
  classification  jsonb not null default '{}'::jsonb,
  assigned_to     uuid references auth.users (id) on delete set null,
  admin_notes     text check (admin_notes is null or char_length(admin_notes) <= 8000),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  resolved_at     timestamptz
);

create index support_tickets_org_status_idx
  on public.support_tickets (organization_id, status, created_at desc);
create index support_tickets_status_priority_idx
  on public.support_tickets (status, priority, created_at desc);
create index support_tickets_user_idx
  on public.support_tickets (user_id, created_at desc);

create trigger support_tickets_set_updated_at
  before update on public.support_tickets
  for each row execute function public.set_updated_at();

alter table public.support_tickets enable row level security;

-- Tenant users see their own tickets. Everything else: RPC.
create policy support_tickets_select_own
  on public.support_tickets for select to authenticated
  using (user_id = (select auth.uid()));

-- ===========================================================================
-- 5. Tenant-facing RPCs.
-- ===========================================================================

-- search_help_articles — ranked full-text search over PUBLISHED articles.
create or replace function public.search_help_articles(p_query text, p_limit int default 5)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb)
  from (
    select a.id, a.category, a.title, a.slug, a.summary, a.content,
      ts_rank(a.search_vector, plainto_tsquery('portuguese', p_query)) as rank
    from public.help_articles a
    where a.status = 'published'
      and (
        p_query is null or btrim(p_query) = ''
        or a.search_vector @@ plainto_tsquery('portuguese', p_query)
      )
    order by rank desc nulls last, a.updated_at desc
    limit least(greatest(coalesce(p_limit, 5), 1), 20)
  ) t;
$$;

grant execute on function public.search_help_articles(text, int) to authenticated;

-- support_start_conversation — opens a conversation for the caller.
create or replace function public.support_start_conversation(
  p_organization_id uuid, p_route text, p_module text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_organization_member(p_organization_id) then
    raise exception 'FORBIDDEN';
  end if;

  insert into public.support_conversations
    (organization_id, user_id, current_route, module)
  values (p_organization_id, v_uid, left(p_route, 200), left(p_module, 60))
  returning id into v_id;

  return jsonb_build_object('ok', true, 'conversation_id', v_id);
end;
$$;

revoke all on function public.support_start_conversation(uuid, text, text) from public;
grant execute on function public.support_start_conversation(uuid, text, text) to authenticated;

-- support_append_message — one user turn + its assistant answer, atomically.
-- The Claude call happens in the server action; this only persists the result.
create or replace function public.support_append_message(
  p_conversation_id uuid,
  p_user_content    text,
  p_assistant_content text,
  p_article_refs    uuid[],
  p_model           text,
  p_input_tokens    int,
  p_output_tokens   int,
  p_latency_ms      int
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select user_id into v_owner from public.support_conversations
  where id = p_conversation_id for update;
  if v_owner is null then raise exception 'CONVERSATION_NOT_FOUND'; end if;
  if v_owner <> v_uid then raise exception 'FORBIDDEN'; end if;

  insert into public.support_messages (conversation_id, role, content)
  values (p_conversation_id, 'user', left(coalesce(p_user_content, ''), 8000));

  insert into public.support_messages (
    conversation_id, role, content, article_refs, model,
    input_tokens, output_tokens, latency_ms
  ) values (
    p_conversation_id, 'assistant', left(coalesce(p_assistant_content, ''), 20000),
    coalesce(p_article_refs, '{}'), p_model,
    p_input_tokens, p_output_tokens, p_latency_ms
  );

  update public.support_conversations set updated_at = now()
  where id = p_conversation_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.support_append_message(uuid, text, text, uuid[], text, int, int, int) from public;
grant execute on function public.support_append_message(uuid, text, text, uuid[], text, int, int, int) to authenticated;

-- support_record_failure — a technical failure of the model, no stack.
create or replace function public.support_record_failure(
  p_conversation_id uuid, p_user_content text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select user_id into v_owner from public.support_conversations
  where id = p_conversation_id;
  if v_owner is null or v_owner <> v_uid then raise exception 'FORBIDDEN'; end if;

  insert into public.support_messages (conversation_id, role, content)
  values (p_conversation_id, 'user', left(coalesce(p_user_content, ''), 8000));
  insert into public.support_messages (conversation_id, role, content)
  values (p_conversation_id, 'system_event', 'assistant_unavailable');

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.support_record_failure(uuid, text) from public;
grant execute on function public.support_record_failure(uuid, text) to authenticated;

-- support_feedback — 👍 resolves; 👎 leaves it open for escalation.
create or replace function public.support_feedback(
  p_conversation_id uuid, p_resolved boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_owner uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select user_id into v_owner from public.support_conversations
  where id = p_conversation_id for update;
  if v_owner is null or v_owner <> v_uid then raise exception 'FORBIDDEN'; end if;

  if p_resolved then
    update public.support_conversations set
      status = 'resolved', ai_resolved = true, closed_at = now()
    where id = p_conversation_id and status = 'open';
  end if;

  insert into public.support_messages (conversation_id, role, content)
  values (p_conversation_id, 'system_event',
    case when p_resolved then 'feedback_resolved' else 'feedback_unresolved' end);

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.support_feedback(uuid, boolean) from public;
grant execute on function public.support_feedback(uuid, boolean) to authenticated;

-- support_escalate — turn a conversation into a human ticket.
create or replace function public.support_escalate(
  p_conversation_id uuid,
  p_type            text,
  p_subject         text,
  p_description     text,
  p_classification  jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_conv public.support_conversations%rowtype;
  v_id  uuid;
  v_type text := coalesce(nullif(btrim(p_type), ''), 'question');
  v_subject text := btrim(coalesce(p_subject, ''));
  v_desc text := btrim(coalesce(p_description, ''));
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_conv from public.support_conversations
  where id = p_conversation_id for update;
  if v_conv.id is null then raise exception 'CONVERSATION_NOT_FOUND'; end if;
  if v_conv.user_id <> v_uid then raise exception 'FORBIDDEN'; end if;
  if v_type not in ('question', 'account', 'bug', 'feature_request', 'other') then
    raise exception 'INVALID_TYPE';
  end if;
  if v_subject = '' or char_length(v_subject) > 200 then raise exception 'INVALID_SUBJECT'; end if;
  if v_desc = '' or char_length(v_desc) > 8000 then raise exception 'INVALID_DESCRIPTION'; end if;

  insert into public.support_tickets (
    organization_id, conversation_id, user_id, type, subject, description,
    current_route, module, classification
  ) values (
    v_conv.organization_id, v_conv.id, v_uid, v_type, v_subject, v_desc,
    v_conv.current_route, v_conv.module,
    case when jsonb_typeof(p_classification) = 'object' then p_classification else '{}'::jsonb end
  )
  returning id into v_id;

  update public.support_conversations set status = 'escalated'
  where id = p_conversation_id;

  insert into public.support_messages (conversation_id, role, content)
  values (p_conversation_id, 'system_event', 'escalated');

  return jsonb_build_object('ok', true, 'ticket_id', v_id);
end;
$$;

revoke all on function public.support_escalate(uuid, text, text, text, jsonb) from public;
grant execute on function public.support_escalate(uuid, text, text, text, jsonb) to authenticated;

-- ===========================================================================
-- 6. Platform-admin RPCs.
-- ===========================================================================

create or replace function public.admin_support_overview()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_resolved int;
  v_with_signal int;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;

  select count(*) filter (where ai_resolved) into v_resolved from public.support_conversations;
  -- conversations that produced a signal: resolved OR escalated.
  select count(*) into v_with_signal from public.support_conversations
  where status in ('resolved', 'escalated');

  return jsonb_build_object(
    'conversations', (select count(*) from public.support_conversations),
    'ai_resolved', v_resolved,
    'escalated', (select count(*) from public.support_conversations where status = 'escalated'),
    'tickets_open', (select count(*) from public.support_tickets where status in ('open', 'in_progress')),
    'tickets_critical', (select count(*) from public.support_tickets where priority = 'critical' and status in ('open', 'in_progress')),
    -- AI Resolution Rate = ai_resolved / (conversations that reached a resolution/escalation)
    'ai_resolution_rate',
      case when v_with_signal = 0 then null
      else round(v_resolved::numeric / v_with_signal, 4) end
  );
end;
$$;

revoke all on function public.admin_support_overview() from public;
grant execute on function public.admin_support_overview() to authenticated;

create or replace function public.admin_list_support_tickets(
  p_status text default null,
  p_priority text default null,
  p_type text default null,
  p_organization_id uuid default null,
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lim int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_off int := greatest(coalesce(p_offset, 0), 0);
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;

  return coalesce((
    select jsonb_agg(row_to_json(t))
    from (
      select tk.id, tk.type, tk.status, tk.priority, tk.subject,
        tk.module, tk.created_at, tk.updated_at,
        o.name as organization_name,
        (select email from auth.users u where u.id = tk.assigned_to) as assigned_email
      from public.support_tickets tk
      join public.organizations o on o.id = tk.organization_id
      where (p_status is null or tk.status = p_status)
        and (p_priority is null or tk.priority = p_priority)
        and (p_type is null or tk.type = p_type)
        and (p_organization_id is null or tk.organization_id = p_organization_id)
      order by
        case tk.priority when 'critical' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
        tk.created_at desc
      limit v_lim offset v_off
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_support_tickets(text, text, text, uuid, int, int) from public;
grant execute on function public.admin_list_support_tickets(text, text, text, uuid, int, int) to authenticated;

create or replace function public.admin_get_support_ticket(p_ticket_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;

  select jsonb_build_object(
    'id', tk.id, 'type', tk.type, 'status', tk.status, 'priority', tk.priority,
    'subject', tk.subject, 'description', tk.description,
    'current_route', tk.current_route, 'module', tk.module,
    'classification', tk.classification, 'admin_notes', tk.admin_notes,
    'created_at', tk.created_at, 'resolved_at', tk.resolved_at,
    'organization_id', tk.organization_id,
    'organization_name', o.name,
    'organization_plan', s.plan_code,
    'reporter_email', (select email from auth.users u where u.id = tk.user_id),
    'assigned_email', (select email from auth.users u where u.id = tk.assigned_to),
    'conversation', case when tk.conversation_id is null then null else (
      select jsonb_agg(jsonb_build_object('role', m.role, 'content', m.content, 'article_refs', m.article_refs, 'created_at', m.created_at) order by m.created_at)
      from public.support_messages m where m.conversation_id = tk.conversation_id
    ) end,
    'article_titles', coalesce((
      select jsonb_agg(distinct a.title)
      from public.support_messages m
      cross join lateral unnest(m.article_refs) ref
      join public.help_articles a on a.id = ref
      where m.conversation_id = tk.conversation_id
    ), '[]'::jsonb)
  )
  into v_row
  from public.support_tickets tk
  join public.organizations o on o.id = tk.organization_id
  left join public.organization_subscriptions s on s.organization_id = tk.organization_id
  where tk.id = p_ticket_id;

  if v_row is null then raise exception 'TICKET_NOT_FOUND'; end if;
  return v_row;
end;
$$;

revoke all on function public.admin_get_support_ticket(uuid) from public;
grant execute on function public.admin_get_support_ticket(uuid) to authenticated;

create or replace function public.admin_update_support_ticket(
  p_ticket_id uuid,
  p_status text default null,
  p_priority text default null,
  p_assign_self boolean default null,
  p_admin_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from public.support_tickets where id = p_ticket_id) then
    raise exception 'TICKET_NOT_FOUND';
  end if;
  if p_status is not null and p_status not in ('open', 'in_progress', 'resolved', 'closed') then
    raise exception 'INVALID_STATUS';
  end if;
  if p_priority is not null and p_priority not in ('low', 'normal', 'high', 'critical') then
    raise exception 'INVALID_PRIORITY';
  end if;

  update public.support_tickets set
    status      = coalesce(p_status, status),
    priority    = coalesce(p_priority, priority),
    assigned_to = case when p_assign_self is true then v_uid else assigned_to end,
    admin_notes = case when p_admin_notes is null then admin_notes else left(p_admin_notes, 8000) end,
    resolved_at = case when p_status in ('resolved', 'closed') then now()
                       when p_status is not null then null else resolved_at end
  where id = p_ticket_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.admin_update_support_ticket(uuid, text, text, boolean, text) from public;
grant execute on function public.admin_update_support_ticket(uuid, text, text, boolean, text) to authenticated;

-- Knowledge admin.
create or replace function public.admin_list_help_articles(p_status text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;
  return coalesce((
    select jsonb_agg(row_to_json(t))
    from (
      select a.id, a.category, a.title, a.slug, a.summary, a.content,
        a.keywords, a.status, a.updated_at
      from public.help_articles a
      where p_status is null or a.status = p_status
      order by a.category, a.title
    ) t
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.admin_list_help_articles(text) from public;
grant execute on function public.admin_list_help_articles(text) to authenticated;

create or replace function public.admin_upsert_help_article(
  p_id uuid,
  p_category text,
  p_title text,
  p_slug text,
  p_summary text,
  p_content text,
  p_keywords text[],
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_id  uuid;
  v_slug text := lower(btrim(coalesce(p_slug, '')));
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_platform_admin() then raise exception 'FORBIDDEN'; end if;
  if v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'INVALID_SLUG'; end if;
  if btrim(coalesce(p_title, '')) = '' or btrim(coalesce(p_content, '')) = '' then
    raise exception 'INVALID_ARTICLE';
  end if;
  if coalesce(p_status, 'draft') not in ('draft', 'published', 'archived') then
    raise exception 'INVALID_STATUS';
  end if;

  if p_id is null then
    insert into public.help_articles
      (category, title, slug, summary, content, keywords, status, created_by, updated_by)
    values (
      btrim(p_category), btrim(p_title), v_slug, nullif(btrim(coalesce(p_summary, '')), ''),
      p_content, coalesce(p_keywords, '{}'), coalesce(p_status, 'draft'), v_uid, v_uid
    )
    returning id into v_id;
  else
    update public.help_articles set
      category = btrim(p_category), title = btrim(p_title), slug = v_slug,
      summary = nullif(btrim(coalesce(p_summary, '')), ''), content = p_content,
      keywords = coalesce(p_keywords, '{}'), status = coalesce(p_status, status),
      updated_by = v_uid
    where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'ARTICLE_NOT_FOUND'; end if;
  end if;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.admin_upsert_help_article(uuid, text, text, text, text, text, text[], text) from public;
grant execute on function public.admin_upsert_help_article(uuid, text, text, text, text, text, text[], text) to authenticated;
