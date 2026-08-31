/**
 * FASE 8A (+ subdomain-identity adjustment) — tenant subdomains. Real Supabase,
 * no Claude.
 *
 * `getCurrentOrganization` runs in Next server context (reads `headers()`), so
 * it can't be imported here. Instead we exercise the exact query it runs on the
 * tenant path — `organization_members` inner-joined to `organizations` filtered
 * by `organizations.subdomain` — under RLS, proving:
 *   - the host is matched on `subdomain`, NOT `slug` (they are independent:
 *     slug "p8a-a-<stamp>" vs subdomain "p8aa<stamp>", mirroring
 *     "rare-way" / "rareway")
 *   - a member on their own subdomain resolves to their org
 *   - a member on someone else's subdomain resolves to NOTHING (never a
 *     fallback, never a cross-tenant leak) — the host selects context, RLS is
 *     the barrier
 *   - the slug host ("p8a-a-<stamp>.zoviah.app") does NOT resolve
 *   - the public-form slug lookup is untouched
 *   - the root-domain path (earliest membership) is unchanged
 *   - duplicate / reserved / malformed subdomains are rejected by the DB
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveHostContext } from "../src/lib/tenant/host.ts";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && anonKey && serviceKey);

// The subdomain column ships in migration 20260831000001. Probe for it so the
// suite skips cleanly (like phase 6A/7A) until the operator applies it.
let ready = false;
if (configured) {
  const probe = createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const c = await probe.from("organizations").select("subdomain").limit(1);
  const f = await probe.rpc("is_reserved_subdomain", { p_label: "admin" });
  ready = !c.error && !f.error;
}

const skip = !configured
  ? "Supabase credentials not set"
  : !ready
    ? "migration 20260831000001_organization_subdomain.sql not applied"
    : false;

const stamp = Date.now();
const pwd = (p: string) => `${p}1!${stamp}zz`;

function anon(): SupabaseClient {
  return createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
const clientByEmail = new Map<string, SupabaseClient>();
async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const cached = clientByEmail.get(email);
  if (cached) return cached;
  const c = anon();
  for (let i = 0; i < 4; i += 1) {
    const { error } = await c.auth.signInWithPassword({ email, password });
    if (!error) {
      clientByEmail.set(email, c);
      return c;
    }
    await new Promise((r) => setTimeout(r, 500 * (i + 1)));
  }
  assert.fail("sign-in failed");
}

const ORG_SELECT = `role,
   organizations!inner ( id, name, slug, subdomain, status )`;

/**
 * With no generated DB types, supabase-js infers a to-one embed as an array.
 * At runtime PostgREST returns a single object for an `!inner` to-one join —
 * exactly how `shape()` in features/organizations/queries.ts reads it.
 */
function orgOf(row: unknown): {
  id: string;
  slug: string;
  subdomain: string | null;
} {
  const o = (row as { organizations: unknown }).organizations;
  return (Array.isArray(o) ? o[0] : o) as {
    id: string;
    slug: string;
    subdomain: string | null;
  };
}

describe("Phase 8A — tenant subdomains (subdomain identity)", { skip }, () => {
  let admin: SupabaseClient;
  const users: Record<string, { id: string; email: string; password: string }> =
    {};
  let orgA = "";
  let orgB = "";
  // slug keeps its hyphenated shape (used by /p/<slug>/...); subdomain is a
  // separate, hyphen-free commercial label — exactly like rare-way / rareway.
  const slugA = `p8a-a-${stamp}`;
  const slugB = `p8a-b-${stamp}`;
  const subA = `p8aa${stamp}`;
  const subB = `p8ab${stamp}`;

  before(async () => {
    admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    for (const k of ["a", "b"]) {
      const email = `p8a-${k}-${stamp}@example.test`;
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password: pwd(k),
        email_confirm: true,
      });
      assert.ifError(error);
      users[k] = { id: data.user!.id, email, password: pwd(k) };
    }
    const a = await admin
      .from("organizations")
      .insert({ name: "P8A A", slug: slugA, subdomain: subA })
      .select("id")
      .single();
    assert.ifError(a.error);
    orgA = a.data!.id;
    const b = await admin
      .from("organizations")
      .insert({ name: "P8A B", slug: slugB, subdomain: subB })
      .select("id")
      .single();
    assert.ifError(b.error);
    orgB = b.data!.id;
    await admin.from("organization_members").insert([
      { organization_id: orgA, user_id: users.a.id, role: "owner" },
      { organization_id: orgB, user_id: users.b.id, role: "owner" },
    ]);
  });

  after(async () => {
    if (!admin) return;
    for (const id of [orgA, orgB].filter(Boolean)) {
      await admin.from("organizations").delete().eq("id", id);
    }
    for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
  });

  test("host resolver maps the subdomain label (pure, no query param)", () => {
    assert.deepEqual(resolveHostContext(`${subA}.zoviah.app`, "zoviah.app"), {
      kind: "tenant",
      subdomain: subA,
    });
    assert.deepEqual(resolveHostContext("zoviah.app", "zoviah.app"), {
      kind: "root",
    });
  });

  test("tenant path: slug=p8a-a-* + subdomain=p8aa* -> p8aa*.zoviah.app resolves org A", async () => {
    const ua = await signedIn(users.a.email, users.a.password);
    const { data, error } = await ua
      .from("organization_members")
      .select(ORG_SELECT)
      .eq("organizations.subdomain", subA)
      .limit(1)
      .maybeSingle();
    assert.ifError(error);
    assert.ok(data?.organizations);
    assert.equal(orgOf(data).id, orgA);
    assert.equal(orgOf(data).slug, slugA);
    assert.equal(orgOf(data).subdomain, subA);
    assert.equal(data.role, "owner");
  });

  test("the slug host (p8a-a-*.zoviah.app) does NOT resolve — subdomain only", async () => {
    const ua = await signedIn(users.a.email, users.a.password);
    // Someone points the slug at a host. No org has slugA as its *subdomain*.
    const { data, error } = await ua
      .from("organization_members")
      .select(ORG_SELECT)
      .eq("organizations.subdomain", slugA)
      .limit(1)
      .maybeSingle();
    assert.ifError(error);
    assert.equal(data, null, "slug is not a subdomain");
  });

  test("tenant path: a member on ANOTHER org's subdomain resolves to NOTHING", async () => {
    const ua = await signedIn(users.a.email, users.a.password);
    const { data, error } = await ua
      .from("organization_members")
      .select(ORG_SELECT)
      .eq("organizations.subdomain", subB) // user A is NOT a member of B
      .limit(1)
      .maybeSingle();
    assert.ifError(error);
    assert.equal(data, null, "no fallback, no cross-tenant leak");
  });

  test("hostname never bypasses RLS: user A cannot read org B by subdomain at all", async () => {
    const ua = await signedIn(users.a.email, users.a.password);
    const direct = await ua
      .from("organizations")
      .select("id")
      .eq("subdomain", subB)
      .maybeSingle();
    assert.equal(direct.data, null);
  });

  test("public form URLs preserved: the slug lookup still finds org A", async () => {
    const ua = await signedIn(users.a.email, users.a.password);
    const { data, error } = await ua
      .from("organizations")
      .select("id, slug")
      .eq("slug", slugA)
      .maybeSingle();
    assert.ifError(error);
    assert.equal(data?.id, orgA);
    assert.equal(data?.slug, slugA);
  });

  test("root path unchanged: earliest membership for the signed-in user", async () => {
    const ub = await signedIn(users.b.email, users.b.password);
    const { data, error } = await ub
      .from("organization_members")
      .select(ORG_SELECT)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    assert.ifError(error);
    assert.ok(data?.organizations);
    assert.equal(orgOf(data).id, orgB);
  });

  test("unknown subdomain: query returns nothing (deny screen, not a 500)", async () => {
    const ua = await signedIn(users.a.email, users.a.password);
    const { data, error } = await ua
      .from("organization_members")
      .select(ORG_SELECT)
      .eq("organizations.subdomain", `nope${stamp}`)
      .limit(1)
      .maybeSingle();
    assert.ifError(error);
    assert.equal(data, null);
  });

  test("duplicate subdomain is blocked by the unique index", async () => {
    const dup = await admin
      .from("organizations")
      .insert({ name: "P8A dup", slug: `p8a-dup-${stamp}`, subdomain: subA })
      .select("id")
      .single();
    assert.ok(dup.error, "second org with the same subdomain must fail");
    assert.equal(dup.error?.code, "23505"); // unique_violation
  });

  test("malformed subdomain is blocked by the format check", async () => {
    const bad = await admin
      .from("organizations")
      .insert({
        name: "P8A bad",
        slug: `p8a-bad-${stamp}`,
        subdomain: "Bad_Sub",
      })
      .select("id")
      .single();
    assert.ok(bad.error, "uppercase / underscore subdomain must fail");
  });

  test("reserved labels are recognised by is_reserved_subdomain", async () => {
    for (const label of ["www", "admin", "api", "app"]) {
      const { data, error } = await admin.rpc("is_reserved_subdomain", {
        p_label: label,
      });
      assert.ifError(error);
      assert.equal(data, true, label);
    }
    const free = await admin.rpc("is_reserved_subdomain", { p_label: subA });
    assert.equal(free.data, false);
  });
});
