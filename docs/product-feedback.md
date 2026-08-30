# Product feedback (Fase 6B)

Feature requests, organization-scoped voting, a public roadmap, and a
changelog ("Novidades"). Turns recurring customer input into a visible,
prioritisable signal without a human triaging every message.

Migration: `supabase/migrations/20260830000003_product_feedback.sql`.

---

## 1. `feature_requests`

Columns: `organization_id`, `created_by`, `title`, `problem`, `use_case`,
`frequency` (`rarely | sometimes | often | daily`), `importance`
(`nice_to_have | important | essential`), `status`
(`submitted | under_review | planned | in_progress | released | declined`),
`canonical_request_id` (self-FK), `admin_note`.

RLS `select`: a tenant sees **its own** requests plus any request already
triaged (`status <> 'submitted'`). A raw `submitted` request from another
tenant stays private until a platform admin reviews it — this keeps the public
board free of noise and duplicates.

`submit_feature_request` validates and inserts, then inserts the submitting
organization's own vote (a request always starts at 1).

### Duplicates

A platform admin sets `canonical_request_id` on the duplicates via
`admin_update_feature_request`. `list_feature_requests` and the admin list
show only canonical rows (`canonical_request_id is null`) and **aggregate**
the votes of the duplicates onto the canonical. `vote_feature_request`
redirects a vote to the canonical row automatically.

---

## 2. `feature_request_votes` — 1 vote per organization (§37)

```
unique (organization_id, request_id)
```

The decision: **one official vote per organization**, not per user. Twenty
seats at the same company must not inflate a request twenty-fold. The row also
records `user_id` (who cast it, for audit) but the constraint is on the org.

`vote_feature_request(organization_id, request_id, vote)`:
`vote = true` → `insert ... on conflict do nothing`; `vote = false` →
`delete`. Returns the fresh `vote_count`. `feature_request_votes` RLS lets a
tenant read only its own vote rows; aggregate counts come from the RPCs.

`tests/phase6b.product.test.ts` proves a second seat in the same org does not
add a vote, and a different org adds exactly one.

---

## 3. `roadmap_items` — no dates (§39)

Columns: `title`, `summary`, `status`
(`under_consideration | planned | in_progress | released`), `sort_order`,
`feature_request_id` (optional link), `published`.

**There is no date, ETA, or deadline column, and none will be added.** The
roadmap communicates direction and order, never a promise. Labels:

| status | label |
|---|---|
| `under_consideration` | Em avaliação |
| `planned` | Planejado |
| `in_progress` | Em desenvolvimento |
| `released` | Lançado |

`tests/product.test.ts` scans the labels for time words (`prazo`, `data`,
`trimestre`, `Q1`…) and fails if one appears.

RLS: authenticated users see only `published = true`. Drafts are
platform-admin only, via `admin_list_roadmap_items` /
`admin_upsert_roadmap_item` (§49).

`get_roadmap()` returns published items ordered in-progress → planned →
under-consideration → released, then `sort_order`.

---

## 4. `changelog_entries` — "Novidades"

Columns: `title`, `summary`, `content`, `status` (`draft | published`),
`published_at` (stamped on the first publish, cleared if returned to draft),
`related_roadmap_item_id`, `created_by`.

RLS: authenticated users see only `status = 'published'`. `get_changelog(limit)`
returns published entries newest-first.

---

## 5. UI

### Tenant

- **"Ajuda"** button in the topbar (`HelpCenter`, `src/features/support/
  components/help-center.tsx`) — the assistant plus links to "Minhas
  solicitações", "Enviar sugestão", "Roadmap".
- `/app/suggestions` — the shared board with per-request org vote count, an
  up-vote toggle, and the submission form (title, problem, use case,
  frequency, importance). Copy states the one-vote-per-org rule
  (`VOTE_SCOPE_NOTE`).
- `/app/roadmap` — four columns, published items only, no dates.
- `/app/changelog` — "Novidades", also a primary nav entry.

### Platform admin — `/admin/product`

One page, three sections: triage feature-request status (and mark canonical
duplicates via the RPC); create/edit/publish roadmap items; create/edit/
publish changelog entries. All backed by `admin_*` RPCs gated on
`is_platform_admin()`.

---

## 6. Testing

| Suite | Command | Notes |
|---|---|---|
| Pure (labels, roadmap ordering, no-date scan, vote-note) | `npm test` → `tests/product.test.ts` | — |
| Integration (real Supabase, no Claude) | `npm test` → `tests/phase6b.product.test.ts` | skips until migration `20260830000003` is applied |

Covered by integration: submit → auto-vote; second seat does not add a vote;
another org adds/removes exactly one; `submitted` request hidden cross-tenant
until triaged; roadmap draft hidden / published visible / carries no date;
changelog draft hidden / published visible with `published_at`; tenants cannot
call the admin curation RPCs; tenants cannot read another org's vote rows.
