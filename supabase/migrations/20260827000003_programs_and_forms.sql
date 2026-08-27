-- Creator Hub — Phase 1 schema: Programs, Form Builder, Creators, Applications.
--
-- Tenancy: every table carries `organization_id` and is guarded by RLS built on
-- `public.is_organization_member()` (see 20260827000004_programs_forms_rls.sql).
--
-- Model:  Organization -> Program -> Application ; Creator is the person.
--         A Creator may hold many Applications (across programs, and — later —
--         more than one per program). Person status != application status.

-- ---------------------------------------------------------------------------
-- programs
-- ---------------------------------------------------------------------------
create table public.programs (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references public.organizations (id) on delete cascade,
  name               text not null,
  slug               text not null,
  description        text,
  status             text not null default 'draft',
  public_title       text,
  public_description text,
  success_message    text,
  form_version       integer not null default 1,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  archived_at        timestamptz,
  constraint programs_status_check
    check (status in ('draft', 'active', 'paused', 'archived')),
  constraint programs_slug_format_check
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint programs_form_version_check check (form_version >= 1),
  -- slug is unique *within* an organization, not globally:
  -- "rare-way / creators" and "other-org / creators" can coexist.
  constraint programs_org_slug_key unique (organization_id, slug)
);

create index programs_org_status_idx
  on public.programs (organization_id, status);

create trigger programs_set_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- form_fields
--   Field definitions for a program's public form. Answers are stored as a
--   JSONB map on applications (no row-per-answer table) plus a field snapshot,
--   so an old application stays interpretable without the current form.
-- ---------------------------------------------------------------------------
create table public.form_fields (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  program_id      uuid not null references public.programs (id) on delete cascade,
  field_key       text not null,
  label           text not null,
  field_type      text not null,
  placeholder     text,
  help_text       text,
  required        boolean not null default false,
  options         jsonb,          -- [{ "value": "...", "label": "..." }] for selects
  configuration   jsonb not null default '{}'::jsonb, -- { "mapping": "email" | ... }
  position        integer not null default 0,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint form_fields_type_check check (field_type in (
    'text', 'textarea', 'email', 'phone', 'number', 'url', 'date',
    'single_select', 'multi_select', 'checkbox', 'instagram', 'tiktok'
  )),
  constraint form_fields_key_format_check check (field_key ~ '^[a-z][a-z0-9_]*$'),
  constraint form_fields_program_key_key unique (program_id, field_key)
);

create index form_fields_program_position_idx
  on public.form_fields (program_id, position);
create index form_fields_organization_id_idx
  on public.form_fields (organization_id);

create trigger form_fields_set_updated_at
  before update on public.form_fields
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- creators  (the person — no application status here)
-- ---------------------------------------------------------------------------
create table public.creators (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name       text not null,
  preferred_name  text,
  birth_date      date,
  email           text,
  phone_e164      text,
  city            text,
  state           text,
  postal_code     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz
);

-- Dedup / lookup indexes, scoped to the tenant. Partial so blank contacts
-- don't collide.
create index creators_org_email_idx
  on public.creators (organization_id, lower(email))
  where email is not null;
create index creators_org_phone_idx
  on public.creators (organization_id, phone_e164)
  where phone_e164 is not null;

create trigger creators_set_updated_at
  before update on public.creators
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- creator_social_profiles
--   Handles live here, not on creators, so new platforms never touch the
--   creators table. `handle_normalized` is the comparable form (no '@', lower).
-- ---------------------------------------------------------------------------
create table public.creator_social_profiles (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations (id) on delete cascade,
  creator_id             uuid not null references public.creators (id) on delete cascade,
  platform               text not null,
  handle                 text not null,
  handle_normalized      text not null,
  profile_url            text,
  followers_declared     bigint,
  average_views_declared bigint,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint creator_social_profiles_platform_check check (platform in (
    'instagram', 'tiktok', 'youtube', 'twitch', 'kwai', 'x', 'facebook', 'other'
  )),
  -- One normalized handle per platform per tenant => also the concurrency
  -- backstop for dedup (see submit_application).
  constraint creator_social_profiles_org_platform_handle_key
    unique (organization_id, platform, handle_normalized)
);

create index creator_social_profiles_org_platform_handle_idx
  on public.creator_social_profiles (organization_id, platform, handle_normalized);
create index creator_social_profiles_creator_id_idx
  on public.creator_social_profiles (creator_id);

create trigger creator_social_profiles_set_updated_at
  before update on public.creator_social_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- applications  (a person's entry in a program)
-- ---------------------------------------------------------------------------
create table public.applications (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  program_id       uuid not null references public.programs (id) on delete restrict,
  creator_id       uuid not null references public.creators (id) on delete cascade,
  status           text not null default 'new',
  form_version     integer not null,
  answers          jsonb not null default '{}'::jsonb,
  field_snapshot   jsonb not null default '[]'::jsonb, -- [{field_key,label,field_type}]
  possible_duplicate boolean not null default false,
  source           text,
  referrer         text,
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  utm_content      text,
  utm_term         text,
  submitted_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz,
  -- Full state machine arrives in Phase 2; only 'new' is valid now.
  constraint applications_status_check check (status in ('new'))
);

create index applications_org_program_submitted_idx
  on public.applications (organization_id, program_id, submitted_at desc);
create index applications_org_creator_idx
  on public.applications (organization_id, creator_id);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- creator_events
--   Minimal append-only log so Phase 2 can build a timeline without having
--   lost history. NOT event sourcing; no UI in this phase.
-- ---------------------------------------------------------------------------
create table public.creator_events (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  creator_id      uuid not null references public.creators (id) on delete cascade,
  application_id  uuid references public.applications (id) on delete set null,
  type            text not null,
  data            jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index creator_events_org_creator_created_idx
  on public.creator_events (organization_id, creator_id, created_at desc);
