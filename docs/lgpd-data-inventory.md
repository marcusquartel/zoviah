# LGPD — technical data inventory

A technical inventory of the personal data Creator Hub stores, for whoever
writes the privacy policy and defines retention. **Not a legal opinion.**

Confirmed as of Phase 7A: **CPF is not stored.** The `creator_addresses.cpf`
column added in `20260829000003` was dropped in `20260829000005`
(`alter table … drop column cpf`, `drop function is_valid_cpf`; 0 non-null rows
at drop; null `cpf` keys purged from `shipments.address_snapshot`). The
remaining `cpf` strings in `src/` are guard regexes and assistant-prompt text
("do not ask for CPF"), never storage. **Do not reintroduce it.**

---

## Inventory

| Personal data | Table.column | Technical purpose | Who can read it |
|---|---|---|---|
| Full name, preferred name | `creators.full_name`, `preferred_name` | Identify the creator in the CRM | Tenant members (RLS). Platform admin: **no** |
| Birth date | `creators.birth_date` | Optional registration field | Tenant members |
| E-mail | `creators.email` | Contact + dedup (`lower(email)` index) | Tenant members |
| Phone | `creators.phone_e164` | Contact + weak duplicate signal | Tenant members |
| City / state / postal code (registration) | `creators.city`, `state`, `postal_code` | Geographic segmentation | Tenant members |
| Social handles / URLs, declared followers | `creator_social_profiles.*` | Creator evaluation | Tenant members |
| Free-text form answers | `applications.answers` (jsonb) | The program application | Tenant members |
| UTM / referrer / source | `applications.utm_*`, `referrer`, `source` | Attribution | Tenant members |
| Observed social metrics | `social_metric_snapshots.*` | Evidence for the Creator Score | Tenant members |
| Analysis input snapshot / raw result | `creator_analyses.input_snapshot`, `raw_result` | Creator Score history | Tenant members |
| **Shipping address** (recipient, postal code, street, number, complement, neighbourhood, city, state) | `creator_addresses.*` | Product shipping | Tenant members; collected via a secure tokenised link with explicit `consent_at` |
| Frozen address snapshot per shipment | `shipments.address_snapshot` (jsonb) | Immutable record of what was shipped | Tenant members |
| Creator event timeline | `creator_events.data` (jsonb) | CRM audit trail | Tenant members |
| Platform user e-mail | `auth.users.email` (Supabase Auth) | Authentication | Supabase Auth; support/team `SECURITY DEFINER` RPCs surface it to the platform admin |
| Invite e-mail | `organization_invites.email` | Team / owner invite | Tenant admin; **masked** in the public invite lookup |
| Support conversations / tickets | `support_conversations`, `support_messages`, `support_tickets` | Support handling; free text **may** contain PII the user typed | Conversation owner (RLS); platform admin via RPC |

## Data that likely needs a retention policy later

Not built in this phase — flagged for a dedicated LGPD project.

- **`support_messages` / `support_conversations`** — free-text user input;
  no automatic redaction at rest; grows indefinitely.
- **`applications.answers`** — free-text application answers; retained for the
  life of the organization.
- **`creator_addresses`** — sensitive shipping PII; versioned (`is_current`),
  old versions kept.
- **`shipments.address_snapshot`** — address copied into every shipment;
  intentionally immutable, so it outlives edits/deletions of the source
  address.

## Deletion / erasure

There is **no** organization or creator deletion — only organization
suspension. A data-subject erasure request would currently require a manual,
scripted operation. Building a compliant deletion + retention flow is out of
scope for Phase 7A and is tracked as future work.
