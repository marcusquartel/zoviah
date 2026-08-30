# Migration workflow

Migrations live in `supabase/migrations/` as `<timestamp>_name.sql`, the
Supabase CLI format. Today they are applied by pasting each file into the
Supabase **SQL Editor**, in timestamp order. This document is about moving to
`supabase db push` so future releases stop depending on copy-paste.

**No schema was changed for this doc.** Adopting the CLI is a process change.

---

## Current state

- 18 migration files, `20260827000001` … `20260830000004`.
- Applied manually via SQL Editor. There is no `supabase/config.toml` and the
  project is not linked to the CLI.
- Each file is written to be safe as a single statement batch (an error rolls
  the whole file back — see the Phase 6B `help_articles` incident, fixed in
  `20260830000002`).

## Target workflow (Supabase CLI)

One-time, per machine that will run migrations:

```bash
npm i -g supabase           # or use npx supabase
supabase login              # opens a browser
supabase link --project-ref <your-project-ref>
```

`supabase link` creates `supabase/config.toml` and records the project ref. It
does **not** change the database.

Per release:

```bash
# 1. See what would run
supabase migration list

# 2. Apply everything not yet applied, in order
supabase db push
```

`db push` tracks applied migrations in `supabase_migrations.schema_migrations`
in the target database, so it only ever runs new files.

### Backfilling the tracking table

The 18 existing migrations were applied by hand, so the target database has the
**objects** but not the **tracking rows**. Before the first `db push`, tell
Supabase they are already applied:

```bash
supabase migration repair --status applied 20260827000001
# … repeat for each existing file, or:
supabase migration repair --status applied $(ls supabase/migrations | sed -E 's/_.*//')
```

Verify with `supabase migration list` — every existing file should show as
applied, with no pending drift — **before** running `db push` for real.

## Guardrails

- Never point `db push` at production without first running it against a
  staging / branch database and reviewing `supabase migration list`.
- Never edit a migration that is already applied. Add a new
  `create or replace` / `alter` in a new timestamped file (this repo's
  standing rule).
- CI does **not** run `db push`. Migrations are a deliberate operator action.
- Keep writing each migration so a mid-file error is survivable (implicit
  transaction): create tables before the functions that reference them, use
  `create or replace`, schema-qualify everything, `set search_path = ''`.

## Local development

`supabase start` runs a local Postgres + Auth in Docker and applies
`supabase/migrations/` automatically. Optional — the team currently develops
against a shared hosted project.
