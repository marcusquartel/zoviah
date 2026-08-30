# Production readiness — executable checklist

Everything that must be true before pointing a paying customer at the
production instance. Tick each box only with evidence (a screenshot, a command
output, a test result). Items marked **[operator]** need an action outside this
repository — see `docs/manual-external-actions.md`.

The code side is validated centrally: `checkProductionEnv()`
(`src/lib/env/production.ts`, unit-tested in `tests/env.test.ts`) is the single
source of truth for which variables are required and what shape they must have.

---

## Domain & transport

- [ ] **[operator]** Production domain registered and pointing at the host.
- [ ] **[operator]** DNS records propagated (apex + `www` as chosen).
- [ ] **[operator]** HTTPS active; HTTP redirects to HTTPS.
- [ ] `Strict-Transport-Security` present on responses (emitted automatically
      when `NODE_ENV=production` — see `src/lib/security-headers.ts`).

## Environment variables

Set in the host's project settings, never committed. Run the app once and
check `/api/health` returns `{"status":"ok"}`.

- [ ] `NEXT_PUBLIC_SUPABASE_URL` — the project URL (https).
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon or publishable key.
- [ ] `NEXT_PUBLIC_APP_URL` — **required**, `https://`, **not** localhost.
      Used to build every invite and address link. A wrong value silently
      breaks those flows.
- [ ] `NEXT_PUBLIC_TERMS_URL` and `NEXT_PUBLIC_PRIVACY_POLICY_URL` — **required
      in production**; must be `http(s)` (the validator rejects
      `javascript:` / `data:`).
- [ ] `ANTHROPIC_API_KEY` + `ANTHROPIC_MODEL` — optional. Absent ⇒ Creator
      Score is unavailable, the CRM keeps working.
- [ ] `ANTHROPIC_SUPPORT_MODEL` — optional, separate from `ANTHROPIC_MODEL`
      (§8). Absent ⇒ the support assistant degrades to a human ticket.
- [ ] No `NEXT_PUBLIC_`-prefixed secret exists (`grep -r "NEXT_PUBLIC_.*\(SERVICE_ROLE\|ANTHROPIC_API\)" .env*` is empty). The validator flags these as blocking errors.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — only in the CI / scripts environment, never
      in the app runtime, never imported from `src/`.

## Database

- [ ] All migrations in `supabase/migrations/` applied in timestamp order —
      currently **18** files, `20260827000001` … `20260830000004`. See
      `docs/migration-workflow.md`.
- [ ] `bootstrap.sql` run once for the first organization + owner.
- [ ] At least one `platform_admins` row for the operator:
      `insert into platform_admins (user_id) select id from auth.users where email = 'operador@…';`
- [ ] `src/types/database.ts` matches the live schema (it is hand-maintained —
      diff after any migration).

## Auth e-mail

- [ ] **[operator]** SMTP configured in Supabase Auth so invite / confirmation
      / recovery e-mails actually send. See `docs/auth-email-setup.md`.
- [ ] **[operator]** Supabase Auth **Site URL** = `NEXT_PUBLIC_APP_URL`.
- [ ] **[operator]** Supabase Auth **Redirect URLs** allow-list includes
      `${NEXT_PUBLIC_APP_URL}/invite/*` and `${NEXT_PUBLIC_APP_URL}/app`.
- [ ] Decide: e-mail confirmation ON or OFF (the invite-signup flow handles
      both — see `docs/auth-email-setup.md`).

## Backup / restore

- [ ] **[operator]** Backup mechanism confirmed for the current Supabase plan.
- [ ] **[operator]** A restore test actually performed and timed. Do **not**
      tick this from documentation alone. See `docs/backup-runbook.md`.

## Error monitoring

- [ ] **[operator]** Sentry project created; `SENTRY_DSN` (+
      `NEXT_PUBLIC_SENTRY_DSN`) set. The SDK is already wired and is a no-op
      until a DSN is present.
- [ ] Test exception verified: `GET /api/debug-sentry?confirm=1` on the
      deployed instance produces an issue in Sentry.
- [ ] (optional) `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` set in
      CI for source-map upload.

## Security headers

- [ ] Global headers present on a normal response: `X-Content-Type-Options`,
      `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`,
      `Content-Security-Policy-Report-Only`.
- [ ] After ~1–2 weeks with **no** CSP violation reports for legitimate use
      (tenant logos, Supabase, Next assets), switch
      `Content-Security-Policy-Report-Only` → `Content-Security-Policy` in
      `src/lib/security-headers.ts` (`globalSecurityHeaders`).

## Knowledge base

- [ ] `node scripts/seed-help-articles.mjs` run against production (idempotent).
- [ ] Spot-check: the "Ajuda" assistant answers "Como criar um envio?",
      "Como aprovar uma creator?", "O que é Coverage?",
      "Como convidar alguém da equipe?" with the right articles.

## Legal

- [ ] **[operator]** Terms of Service and Privacy Policy written **and reviewed
      by a lawyer** and published at stable URLs.
- [ ] Those URLs set in `NEXT_PUBLIC_TERMS_URL` /
      `NEXT_PUBLIC_PRIVACY_POLICY_URL`; the footer shows them on the public
      form and address page.

## Final gate

- [ ] `npm run lint && npm run typecheck && npm test && npm run build` — all
      green, `npm test` reports `0 fail`, `0 skip` (from applied phases), and
      **0 real Anthropic calls**.
- [ ] `npm run test:anthropic:smoke` and `npm run test:support-ai:smoke` — run
      on demand only; each makes at most one paid call. Not a daily gate.
- [ ] Manual smoke test passed — see the roundtrip in the Phase 7A report /
      `docs/manual-external-actions.md`.
