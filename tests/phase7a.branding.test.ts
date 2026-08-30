/**
 * FASE 7A — platform-admin branding. Real Supabase, no Claude.
 *
 * `admin_set_organization_branding` replaces the hand-written UPDATE an
 * operator used to run in the SQL editor. Skips until migration
 * 20260830000004 is applied.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

let ready = false;
if (configured) {
  const probe = createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const f = await probe.rpc("admin_set_organization_branding", {
    p_organization_id: "00000000-0000-0000-0000-000000000000",
    p_logo_url: null,
    p_favicon_url: null,
  });
  ready = !f.error || !/Could not find the function/.test(f.error.message);
}

const skip = !configured
  ? "Supabase credentials not set"
  : !ready
    ? "Phase 7A schema not applied (run supabase/migrations/20260830000004_go_live_hardening.sql)"
    : false;

const stamp = Date.now();
const pwd = (p: string) => `${p}1!${stamp}zz`;

function anon(): SupabaseClient {
  return createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const c = anon();
  assert.ifError((await c.auth.signInWithPassword({ email, password })).error);
  return c;
}

describe("Phase 7A — admin branding", { skip }, () => {
  let admin: SupabaseClient;
  let pa: SupabaseClient;
  let owner: SupabaseClient;
  const users: Record<string, { id: string; email: string; password: string }> =
    {};
  let orgA = "";
  let orgB = "";

  async function mkUser(key: string) {
    const email = `p7a-b-${key}-${stamp}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: pwd(key),
      email_confirm: true,
    });
    assert.ifError(error);
    users[key] = { id: data.user!.id, email, password: pwd(key) };
  }

  before(async () => {
    admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    for (const k of ["pa", "owner"]) await mkUser(k);
    assert.ifError(
      (await admin.from("platform_admins").insert({ user_id: users.pa.id })).error,
    );
    for (const [key, slug] of [
      ["A", `p7a-brand-a-${stamp}`],
      ["B", `p7a-brand-b-${stamp}`],
    ] as const) {
      const o = await admin
        .from("organizations")
        .insert({ name: `P7A Brand ${key}`, slug })
        .select("id")
        .single();
      assert.ifError(o.error);
      if (key === "A") orgA = o.data!.id;
      else orgB = o.data!.id;
    }
    await admin
      .from("organization_members")
      .insert({ organization_id: orgA, user_id: users.owner.id, role: "owner" });

    pa = await signedIn(users.pa.email, users.pa.password);
    owner = await signedIn(users.owner.email, users.owner.password);
  });

  after(async () => {
    if (!admin) return;
    await admin.from("platform_audit_events").delete().eq("actor_user_id", users.pa.id);
    for (const id of [orgA, orgB].filter(Boolean)) {
      await admin.from("organizations").delete().eq("id", id);
    }
    await admin.from("platform_admins").delete().eq("user_id", users.pa.id);
    for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
  });

  test("1) platform admin sets logo + favicon; get_organization reflects it", async () => {
    const r = await pa.rpc("admin_set_organization_branding", {
      p_organization_id: orgA,
      p_logo_url: "https://cdn.example.com/logo.svg",
      p_favicon_url: "https://cdn.example.com/favicon.png",
    });
    assert.ifError(r.error);

    const settings = await admin
      .from("organization_settings")
      .select("logo_url, favicon_url")
      .eq("organization_id", orgA)
      .single();
    assert.equal(settings.data!.logo_url, "https://cdn.example.com/logo.svg");
    assert.equal(settings.data!.favicon_url, "https://cdn.example.com/favicon.png");

    const detail = await pa.rpc("admin_get_organization", {
      p_organization_id: orgA,
    });
    assert.ifError(detail.error);
    assert.equal(detail.data.logo_url, "https://cdn.example.com/logo.svg");
  });

  test("2) a common tenant user cannot call the branding RPC", async () => {
    const r = await owner.rpc("admin_set_organization_branding", {
      p_organization_id: orgA,
      p_logo_url: "https://evil.example.com/x.png",
      p_favicon_url: null,
    });
    assert.ok(r.error);
    assert.match(r.error!.message, /FORBIDDEN/);
  });

  test("3) javascript:/data: URLs are rejected", async () => {
    for (const bad of ["javascript:alert(1)", "data:image/png;base64,AAAA", "/relative.png"]) {
      const r = await pa.rpc("admin_set_organization_branding", {
        p_organization_id: orgA,
        p_logo_url: bad,
        p_favicon_url: null,
      });
      assert.ok(r.error, `${bad} should be rejected`);
      assert.match(r.error!.message, /INVALID_LOGO_URL/);
    }
  });

  test("4) http and https URLs are accepted; blank clears", async () => {
    const ok = await pa.rpc("admin_set_organization_branding", {
      p_organization_id: orgA,
      p_logo_url: "http://cdn.example.com/logo.png",
      p_favicon_url: "",
    });
    assert.ifError(ok.error);
    const settings = await admin
      .from("organization_settings")
      .select("logo_url, favicon_url")
      .eq("organization_id", orgA)
      .single();
    assert.equal(settings.data!.logo_url, "http://cdn.example.com/logo.png");
    assert.equal(settings.data!.favicon_url, null);
  });

  test("5) setting branding on org A never touches org B", async () => {
    await pa.rpc("admin_set_organization_branding", {
      p_organization_id: orgA,
      p_logo_url: "https://cdn.example.com/a.svg",
      p_favicon_url: null,
    });
    const b = await admin
      .from("organization_settings")
      .select("logo_url")
      .eq("organization_id", orgB)
      .single();
    assert.equal(b.data!.logo_url, null);
  });
});
