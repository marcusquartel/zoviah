# Backup & restore runbook

Zoviah has **no backup engine of its own**. All durable state is in the
Supabase Postgres database; backups are a Supabase-plan feature. This document
is the operator procedure — it does not automate anything.

> **Do not record "backup validated" anywhere until a restore has actually
> been performed and timed** (see step 4).

---

## 1. Confirm the plan and mechanism  **[operator]**

- [ ] Note the current Supabase plan (Free / Pro / Team / Enterprise).
- [ ] In the Supabase dashboard → **Database → Backups**, record what is
      available:
  - **Free**: daily logical backups, ~7-day retention, **no** point-in-time
    recovery (PITR). Restores are coarse (whole-day granularity) and manual.
  - **Pro and above**: daily backups **plus** PITR (retention depends on the
    add-on, typically 7 days, extendable). PITR allows restore to a specific
    second.
- [ ] If the plan is Free, decide before go-live whether daily-only backups are
      acceptable for paying customers. Recommendation: at least Pro with PITR.

## 2. Record the targets  **[operator]**

Fill these in once, from the dashboard and your own tolerance:

| Metric | Value | Source |
|---|---|---|
| Backup frequency | _e.g. daily 04:00 UTC_ | dashboard |
| Retention window | _e.g. 7 days_ | dashboard |
| PITR available | _yes / no_ | dashboard |
| **RPO** (max acceptable data loss) | _e.g. 24h without PITR, ~minutes with PITR_ | policy |
| **RTO** (max acceptable downtime to restore) | _e.g. 2h_ | policy |

## 3. Restore procedure (reference)  **[operator]**

Exact UI wording changes; the shape is:

1. Supabase dashboard → **Database → Backups**.
2. Choose a **daily backup** (Free/Pro) or a **PITR timestamp** (Pro+).
3. Trigger the restore. Supabase restores **in place** on the same project
   (this is destructive to current data) or, on some plans, into a new
   project — prefer a **new project** for a *test* restore so production is
   untouched.
4. After restore, re-point `NEXT_PUBLIC_SUPABASE_URL` /
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` if the project changed, redeploy, and
   re-run the production checklist's health + smoke steps.
5. Re-seed the knowledge base if it was lost:
   `node scripts/seed-help-articles.mjs`.

## 4. Restore **test** (required before go-live)  **[operator]**

- [ ] Take a fresh backup / pick a PITR point.
- [ ] Restore it into a **throwaway** Supabase project.
- [ ] Verify: `Rare Way` organization present, a known creator present, RLS
      still enforced (sign in as a tenant user, confirm cross-tenant queries
      return nothing).
- [ ] Time it end to end. Record the elapsed time as the measured **RTO**.
- [ ] Delete the throwaway project.
- [ ] Only now record the date of the successful restore test.

Last successful restore test: **_not yet performed_**.

## 5. What a backup does NOT cover

- Supabase **Auth** users are part of the same project backup — restored
  together with the data. Good.
- Environment variables live in the **host** (deploy platform), not Supabase —
  keep a separate, secure record of them.
- Uploaded assets: none today (logos are external URLs, no Storage bucket).
