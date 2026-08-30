# Manual external actions — Founding Customer go-live

Everything the codebase **cannot** finish on its own because it needs
credentials, infrastructure, a third-party account, or a human decision. Each
item is owned by the operator (Marcus). Do not mark an item done without the
stated evidence.

| # | Action | Why code can't do it | Evidence to record | Blocking? |
|---|---|---|---|---|
| 1 | **Create the Sentry project**, get the DSN, set `SENTRY_DSN` + `NEXT_PUBLIC_SENTRY_DSN` in the host | Needs a Sentry account + org | `ENABLE_SENTRY_DEBUG_ROUTE=1` + `/api/debug-sentry?confirm=1` on prod creates an issue, then flag removed | P0 for paying customers |
| 2 | **Configure SMTP in Supabase Auth** (provider account, verified sending domain, SPF/DKIM) | Needs an e-mail provider account + DNS | A recovery e-mail arrives, not in spam | P1 (P0 if confirmation stays ON) |
| 3 | **Set Supabase Auth Site URL + Redirect URLs** to the production domain | Dashboard-only setting | Screenshot of URL config | P0 |
| 4 | **Decide e-mail confirmation ON/OFF** for signups | Product/ops decision | Documented choice in `docs/auth-email-setup.md` | P1 |
| 5 | **Register the domain + DNS + HTTPS** | Registrar + host | `curl -I https://<domain>` shows 200 + HSTS | P0 |
| 6 | **Set production env vars** in the host (`NEXT_PUBLIC_APP_URL`, Supabase, legal URLs, optional Anthropic) | Host settings, secrets | `/api/health` = ok; `checkProductionEnv` shows `productionReady` | P0 |
| 7 | **Confirm the Supabase plan + backup mechanism; perform and time a restore test** | Supabase plan + dashboard | Restore test date + measured RTO in `docs/backup-runbook.md` | P0 |
| 8 | **Publish Terms of Service + Privacy Policy, lawyer-reviewed**; set the two URLs | Legal work | Live URLs + review sign-off | P0 |
| 9 | **Apply migration `20260830000004_go_live_hardening.sql`** in the SQL editor (in order, after `…0003`) | DB DDL, operator applies migrations | `prepare_invite_signup` / `rate_limit_public_submission` / `admin_set_organization_branding` present in the API | P0 for this phase's features |
| 10 | **Run `node scripts/seed-help-articles.mjs` against production** | Needs the service role key in a trusted env | Assistant answers the four spot-check questions | P1 |
| 11 | **Add a GitHub remote** so `.github/workflows/ci.yml` runs | Repo has no `origin` | A green CI run on a PR | P2 |
| 12 | (optional) **Set `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` in CI** for source-map upload | Sentry auth token | Readable stack traces in Sentry | P2 |
| 13 | (later) **Adopt `supabase db push`** — link project, `migration repair` the 18 existing files | CLI auth + operator process | `supabase migration list` clean | P2 — see `docs/migration-workflow.md` |

## Not in this phase (do not start)

Branded subdomains, custom domains, impersonation, billing/checkout, public
signup, free trial, Campanhas / Performance / Comissões / Portal Creator /
Shopify / TikTok Shop, the UI refresh (Phase 7B).
