# Auth e-mail (SMTP) setup

The app does **not** integrate a transactional e-mail provider (Resend /
Postmark) directly. It relies on **Supabase Auth** to send the three
account-lifecycle e-mails: signup confirmation, password recovery, and (if you
use it) the Supabase-native invite. Everything here is Supabase dashboard
configuration — no code.

Why it matters for go-live: without working SMTP, an invited person can create
an account from `/invite/[token]` but — if e-mail confirmation is ON — will
never receive the confirmation link. See "Confirmation ON vs OFF" below.

---

## 1. SMTP  **[operator]**

Supabase's built-in sender is rate-limited (a few e-mails per hour) and not
suitable for production. Configure custom SMTP:

- Supabase dashboard → **Authentication → Emails → SMTP Settings** (wording
  varies) → enable custom SMTP.
- Recommended providers: **Resend**, **Postmark**, **Amazon SES**. Any of them
  gives you a host / port / username / password and a verified sending domain.
- **Sender**: use a real address on a domain you control, e.g.
  `no-reply@zoviah.app` (or `no-reply@zoviah.com.br`), display name `Zoviah`.
- Verify SPF / DKIM for the sending domain with the provider — otherwise
  Gmail / Outlook will spam-folder the confirmations.

## 2. URLs  **[operator]**

Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL**: exactly your `NEXT_PUBLIC_APP_URL`
  (e.g. `https://app.zoviah.app`).
- **Redirect URLs** (allow-list): add
  - `${NEXT_PUBLIC_APP_URL}/invite/*`
  - `${NEXT_PUBLIC_APP_URL}/app`
  - `${NEXT_PUBLIC_APP_URL}/login`

  The invite-signup flow passes `emailRedirectTo = ${APP_URL}/invite/<token>`,
  so that pattern must be allowed or the confirmation link is rejected.

## 3. E-mail templates (minimum)  **[operator]**

Supabase dashboard → **Authentication → Emails → Templates**. The defaults
work; at minimum:

- **Confirm signup**: keep the `{{ .ConfirmationURL }}` link, set a clear
  subject ("Confirme seu e-mail — Zoviah"), Portuguese body.
- **Reset password**: keep `{{ .ConfirmationURL }}`, Portuguese subject/body.
- **Invite user** (only if you also use Supabase-native invites — the app's own
  team invites do not need this).

## 4. Confirmation ON vs OFF

Supabase dashboard → **Authentication → Providers → Email → "Confirm email"**.

| Setting | Invite-signup behaviour |
|---|---|
| **OFF** | `signUpFromInvite` gets a session immediately, accepts the invite in the same request, user lands in `/app`. Fastest. Acceptable for Founding Customers if SMTP for **recovery** still works. |
| **ON** (recommended long-term) | `signUpFromInvite` returns `needsEmailConfirmation`. The user clicks the link in their inbox, returns to `/invite/[token]` now authenticated, and the existing "Aceitar convite" button finishes the join. Requires working SMTP. |

The app supports both with no code change. Pick OFF only if SMTP is not ready
on day one and you accept that password recovery e-mails also depend on SMTP.

## 5. Verify  **[operator]**

- [ ] Send yourself a password-recovery e-mail from the Supabase dashboard and
      confirm it arrives (not in spam).
- [ ] Run the manual invite-signup roundtrip (a real invite → new account in an
      incognito window → confirm → accept → `/app`).
