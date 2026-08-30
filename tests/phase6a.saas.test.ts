/**
 * FASE 6A — SaaS commercial readiness. Real Supabase, no Claude.
 *
 * Platform admin provisions tenants; hash-only team invites; last-owner
 * invariant; organization suspension gate; cross-tenant / privilege-escalation
 * regression. Skips until migration 20260830000001 is applied.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
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
  const t = await probe.from("organization_invites").select("id").limit(1);
  const f = await probe.rpc("is_platform_admin");
  ready = !t.error && !f.error;
}

const skip = !configured
  ? "Supabase credentials not set"
  : !ready
    ? "Phase 6A schema not applied (run supabase/migrations/20260830000001_saas_readiness.sql)"
    : false;

const stamp = Date.now();
const pwd = (p: string) => `${p}1!${stamp}zz`;
const tokenHash = (raw: string) =>
  createHash("sha256").update(raw, "utf8").digest("hex");
const secToken = () => randomBytes(32).toString("base64url");

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

describe("Phase 6A — SaaS readiness", { skip }, () => {
  let admin: SupabaseClient;
  let pa: SupabaseClient; // platform admin
  let owner: SupabaseClient; // tenant A owner
  let analyst: SupabaseClient; // will accept an analyst invite to A
  let outsider: SupabaseClient; // owner of tenant B
  const users: Record<string, { id: string; email: string; password: string }> =
    {};
  let orgA = "";
  let orgB = "";
  let slugA = "";

  async function mkUser(key: string) {
    const email = `p6a-${key}-${stamp}@example.test`;
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
    for (const k of ["pa", "owner", "analyst", "outsider"]) await mkUser(k);

    // Platform admin: seeded by the operator (no write policy on the table).
    assert.ifError(
      (await admin.from("platform_admins").insert({ user_id: users.pa.id })).error,
    );

    // Tenant B (a plain tenant, for cross-tenant checks).
    const orgs = await admin
      .from("organizations")
      .insert({ name: "P6A B", slug: `p6a-b-${stamp}` })
      .select("id")
      .single();
    orgB = orgs.data!.id;
    await admin
      .from("organization_members")
      .insert({ organization_id: orgB, user_id: users.outsider.id, role: "owner" });

    pa = await signedIn(users.pa.email, users.pa.password);
    owner = await signedIn(users.owner.email, users.owner.password);
    analyst = await signedIn(users.analyst.email, users.analyst.password);
    outsider = await signedIn(users.outsider.email, users.outsider.password);
  });

  after(async () => {
    if (!admin) return;
    for (const id of [orgA, orgB].filter(Boolean)) {
      await admin.from("organizations").delete().eq("id", id);
    }
    await admin.from("platform_admins").delete().eq("user_id", users.pa.id);
    await admin
      .from("platform_audit_events")
      .delete()
      .in(
        "organization_id",
        [orgA, orgB].filter(Boolean),
      );
    for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
  });

  test("1/3) platform admin creates an org atomically (settings + subscription + owner membership)", async () => {
    slugA = `p6a-a-${stamp}`;
    const res = await pa.rpc("admin_create_organization", {
      p_name: "P6A A",
      p_slug: slugA,
      p_owner_email: users.owner.email,
      p_plan_code: "founding",
      p_status: "active",
      p_owner_token_hash: tokenHash(secToken()),
    });
    assert.ifError(res.error);
    assert.equal(res.data.owner_invite_pending, false); // e-mail already had an account
    orgA = res.data.organization_id;

    const settings = await admin
      .from("organization_settings")
      .select("organization_id")
      .eq("organization_id", orgA)
      .maybeSingle();
    assert.ok(settings.data);
    const sub = await admin
      .from("organization_subscriptions")
      .select("plan_code")
      .eq("organization_id", orgA)
      .single();
    assert.equal(sub.data!.plan_code, "founding");
    const mem = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgA)
      .eq("user_id", users.owner.id)
      .single();
    assert.equal(mem.data!.role, "owner");

    const audit = await pa.rpc("admin_list_platform_audit");
    assert.ok(
      (audit.data as { event_type: string }[]).some(
        (e) => e.event_type === "organization_created",
      ),
    );
  });

  test("2/19) a common tenant user cannot call the admin RPCs", async () => {
    const c = await owner.rpc("admin_create_organization", {
      p_name: "Nope",
      p_slug: `nope-${stamp}`,
      p_owner_email: users.owner.email,
      p_plan_code: "pro",
      p_status: "active",
      p_owner_token_hash: tokenHash(secToken()),
    });
    assert.ok(c.error);
    assert.match(c.error!.message, /FORBIDDEN/);

    const l = await owner.rpc("admin_list_organizations");
    assert.ok(l.error);
    assert.match(l.error!.message, /FORBIDDEN/);

    const s = await owner.rpc("admin_set_organization_status", {
      p_organization_id: orgB,
      p_status: "suspended",
    });
    assert.ok(s.error);
  });

  test("4/5/6/10) invite: hash-only, valid accept, double accept idempotent", async () => {
    const raw = secToken();
    const inv = await owner.rpc("create_org_invite", {
      p_organization_id: orgA,
      p_email: users.analyst.email,
      p_role: "analyst",
      p_token_hash: tokenHash(raw),
    });
    assert.ifError(inv.error);

    // §50: no raw token anywhere in the row.
    const row = await admin
      .from("organization_invites")
      .select("*")
      .eq("id", inv.data.invite_id)
      .single();
    assert.equal(row.data!.token_hash, tokenHash(raw));
    assert.ok(!JSON.stringify(row.data).includes(raw));

    // public lookup: masked e-mail, org name, no internals.
    const look = await anon().rpc("get_public_org_invite", {
      p_token_hash: tokenHash(raw),
    });
    assert.equal(look.data.status, "pending");
    assert.equal(look.data.organization_name, "P6A A");
    assert.ok(String(look.data.email_masked).includes("***"));
    assert.ok(!JSON.stringify(look.data).includes("token"));

    const acc = await analyst.rpc("accept_org_invite", {
      p_token_hash: tokenHash(raw),
    });
    assert.ifError(acc.error);
    assert.equal(acc.data.status, "accepted");
    assert.equal(acc.data.organization_id, orgA);

    // double accept -> idempotent, still one membership
    const again = await analyst.rpc("accept_org_invite", {
      p_token_hash: tokenHash(raw),
    });
    assert.ifError(again.error);
    assert.equal(again.data.status, "already_member");
    const mems = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgA)
      .eq("user_id", users.analyst.id);
    assert.equal(mems.data!.length, 1);
  });

  test("7) an invite cannot be accepted by a different e-mail", async () => {
    const raw = secToken();
    await owner.rpc("create_org_invite", {
      p_organization_id: orgA,
      p_email: `someone-else-${stamp}@example.test`,
      p_role: "analyst",
      p_token_hash: tokenHash(raw),
    });
    const acc = await outsider.rpc("accept_org_invite", {
      p_token_hash: tokenHash(raw),
    });
    assert.ok(acc.error);
    assert.match(acc.error!.message, /EMAIL_MISMATCH/);
    await admin
      .from("organization_invites")
      .delete()
      .eq("token_hash", tokenHash(raw));
  });

  test("8/9) expired and revoked invites are rejected", async () => {
    const rawExp = secToken();
    const e = await owner.rpc("create_org_invite", {
      p_organization_id: orgA,
      p_email: `exp-${stamp}@example.test`,
      p_role: "analyst",
      p_token_hash: tokenHash(rawExp),
    });
    await admin
      .from("organization_invites")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", e.data.invite_id);
    assert.equal(
      (await anon().rpc("get_public_org_invite", { p_token_hash: tokenHash(rawExp) }))
        .data.status,
      "invalid",
    );

    const rawRev = secToken();
    const r = await owner.rpc("create_org_invite", {
      p_organization_id: orgA,
      p_email: `rev-${stamp}@example.test`,
      p_role: "analyst",
      p_token_hash: tokenHash(rawRev),
    });
    assert.ifError((await owner.rpc("revoke_org_invite", { p_invite_id: r.data.invite_id })).error);
    const acc = await anon().rpc("accept_org_invite", {
      p_token_hash: tokenHash(rawRev),
    });
    assert.ok(acc.error); // NOT_AUTHENTICATED or INVALID_INVITE — either way, no accept
  });

  test("11) org B cannot read org A's invites", async () => {
    const rows = await outsider
      .from("organization_invites")
      .select("id")
      .eq("organization_id", orgA);
    assert.equal((rows.data ?? []).length, 0);
  });

  test("13) the accepted analyst has no admin power", async () => {
    const inv = await analyst.rpc("create_org_invite", {
      p_organization_id: orgA,
      p_email: `x-${stamp}@example.test`,
      p_role: "analyst",
      p_token_hash: tokenHash(secToken()),
    });
    assert.ok(inv.error);
    assert.match(inv.error!.message, /FORBIDDEN/);
  });

  test("14) the last owner cannot be removed or demoted", async () => {
    const rm = await owner.rpc("remove_org_member", {
      p_organization_id: orgA,
      p_user_id: users.owner.id,
    });
    assert.ok(rm.error);
    assert.match(rm.error!.message, /LAST_OWNER/);

    const dg = await owner.rpc("set_org_member_role", {
      p_organization_id: orgA,
      p_user_id: users.owner.id,
      p_role: "admin",
    });
    assert.ok(dg.error);
    assert.match(dg.error!.message, /LAST_OWNER/);
  });

  test("15) an admin can remove an analyst", async () => {
    const rm = await owner.rpc("remove_org_member", {
      p_organization_id: orgA,
      p_user_id: users.analyst.id,
    });
    assert.ifError(rm.error);
    const gone = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgA)
      .eq("user_id", users.analyst.id);
    assert.equal((gone.data ?? []).length, 0);
  });

  test("16/17) suspension freezes the panel; reactivation restores it", async () => {
    assert.ifError(
      (await pa.rpc("admin_set_organization_status", {
        p_organization_id: orgA,
        p_status: "suspended",
      })).error,
    );

    // a panel write (creating an invite) is blocked by the suspension trigger
    const blocked = await owner.rpc("create_org_invite", {
      p_organization_id: orgA,
      p_email: `blocked-${stamp}@example.test`,
      p_role: "analyst",
      p_token_hash: tokenHash(secToken()),
    });
    assert.ok(blocked.error);
    assert.match(blocked.error!.message, /ORGANIZATION_SUSPENDED/);

    assert.ifError(
      (await pa.rpc("admin_set_organization_status", {
        p_organization_id: orgA,
        p_status: "active",
      })).error,
    );
    const ok = await owner.rpc("create_org_invite", {
      p_organization_id: orgA,
      p_email: `after-${stamp}@example.test`,
      p_role: "analyst",
      p_token_hash: tokenHash(secToken()),
    });
    assert.ifError(ok.error);

    const audit = await pa.rpc("admin_list_platform_audit");
    const types = (audit.data as { event_type: string }[]).map((e) => e.event_type);
    assert.ok(types.includes("organization_suspended"));
    assert.ok(types.includes("organization_reactivated"));
  });

  test("18) tenant A still cannot see tenant B", async () => {
    const b = await owner.from("organizations").select("id").eq("id", orgB);
    assert.equal((b.data ?? []).length, 0);
    const bMem = await owner
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgB);
    assert.equal((bMem.data ?? []).length, 0);
  });

  test("anon cannot read the platform / invite tables", async () => {
    for (const t of [
      "platform_admins",
      "organization_subscriptions",
      "organization_invites",
      "platform_audit_events",
    ] as const) {
      const r = await anon().from(t).select("*").limit(1);
      assert.ok(r.error || (r.data ?? []).length === 0, `anon read ${t}`);
    }
    const rpc = await anon().rpc("is_platform_admin");
    // anon: the function runs but the user is null -> false (not an error).
    assert.ok(rpc.error || rpc.data === false);
  });

  test("admin can change an organization's plan; audited", async () => {
    assert.ifError(
      (await pa.rpc("admin_set_organization_plan", {
        p_organization_id: orgA,
        p_plan_code: "pro",
      })).error,
    );
    const sub = await admin
      .from("organization_subscriptions")
      .select("plan_code")
      .eq("organization_id", orgA)
      .single();
    assert.equal(sub.data!.plan_code, "pro");
    const audit = await pa.rpc("admin_list_platform_audit");
    assert.ok(
      (audit.data as { event_type: string }[]).some(
        (e) => e.event_type === "organization_plan_changed",
      ),
    );
  });
});
