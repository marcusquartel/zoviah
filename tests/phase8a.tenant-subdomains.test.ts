/**
 * FASE 8A — tenant subdomains. Real Supabase, no Claude.
 *
 * `getCurrentOrganization` runs in Next server context (reads `headers()`), so
 * it can't be imported here. Instead we exercise the exact query it runs on
 * the tenant path — `organization_members` inner-joined to `organizations`
 * filtered by `organizations.slug` — under RLS, proving:
 *   - a member on their own tenant slug resolves to their org
 *   - a member on someone else's tenant slug resolves to NOTHING (never a
 *     fallback, never a cross-tenant leak) — the host selects context, RLS is
 *     the barrier
 *   - the root-domain path (earliest membership) is unchanged
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

const skip = configured ? false : "Supabase credentials not set";

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
   organizations!inner ( id, name, slug, status )`;

/**
 * With no generated DB types, supabase-js infers a to-one embed as an array.
 * At runtime PostgREST returns a single object for an `!inner` to-one join —
 * exactly how `shape()` in features/organizations/queries.ts reads it.
 */
function orgOf(row: unknown): { id: string; slug: string; status: string } {
  const o = (row as { organizations: unknown }).organizations;
  return (Array.isArray(o) ? o[0] : o) as {
    id: string;
    slug: string;
    status: string;
  };
}

describe("Phase 8A — tenant subdomains", { skip }, () => {
  let admin: SupabaseClient;
  const users: Record<string, { id: string; email: string; password: string }> =
    {};
  let orgA = "";
  let orgB = "";
  const slugA = `p8a-a-${stamp}`;
  const slugB = `p8a-b-${stamp}`;

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
      .insert({ name: "P8A A", slug: slugA })
      .select("id")
      .single();
    assert.ifError(a.error);
    orgA = a.data!.id;
    const b = await admin
      .from("organizations")
      .insert({ name: "P8A B", slug: slugB })
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

  test("host resolver maps the tenant slug (pure, no query param)", () => {
    assert.deepEqual(resolveHostContext(`${slugA}.zoviah.app`, "zoviah.app"), {
      kind: "tenant",
      slug: slugA,
    });
    assert.deepEqual(resolveHostContext("zoviah.app", "zoviah.app"), {
      kind: "root",
    });
  });

  test("tenant path: a member on THEIR slug resolves to their org", async () => {
    const ua = await signedIn(users.a.email, users.a.password);
    const { data, error } = await ua
      .from("organization_members")
      .select(ORG_SELECT)
      .eq("organizations.slug", slugA)
      .limit(1)
      .maybeSingle();
    assert.ifError(error);
    assert.ok(data?.organizations);
    assert.equal(orgOf(data).slug, slugA);
    assert.equal(orgOf(data).id, orgA);
    assert.equal(data.role, "owner");
  });

  test("tenant path: a member on ANOTHER org's slug resolves to NOTHING", async () => {
    const ua = await signedIn(users.a.email, users.a.password);
    const { data, error } = await ua
      .from("organization_members")
      .select(ORG_SELECT)
      .eq("organizations.slug", slugB) // user A is NOT a member of B
      .limit(1)
      .maybeSingle();
    assert.ifError(error);
    assert.equal(data, null, "no fallback, no cross-tenant leak");
  });

  test("hostname never bypasses RLS: user A cannot read org B at all", async () => {
    const ua = await signedIn(users.a.email, users.a.password);
    const direct = await ua
      .from("organizations")
      .select("id")
      .eq("slug", slugB)
      .maybeSingle();
    assert.equal(direct.data, null);
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

  test("unknown tenant slug: query returns nothing (deny screen, not a 500)", async () => {
    const ua = await signedIn(users.a.email, users.a.password);
    const { data, error } = await ua
      .from("organization_members")
      .select(ORG_SELECT)
      .eq("organizations.slug", `does-not-exist-${stamp}`)
      .limit(1)
      .maybeSingle();
    assert.ifError(error);
    assert.equal(data, null);
  });
});
