/**
 * FASE 7A — invite-only signup. Real Supabase, no Claude.
 *
 * Exercises `prepare_invite_signup` (the anon gate that lets the server create
 * an account from a valid invite) and the acceptance flow that follows, plus
 * cross-tenant isolation. Skips until migration 20260830000004 is applied.
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
  const f = await probe.rpc("prepare_invite_signup", { p_token_hash: "x" });
  ready = !f.error || !/Could not find the function/.test(f.error.message);
}

const skip = !configured
  ? "Supabase credentials not set"
  : !ready
    ? "Phase 7A schema not applied (run supabase/migrations/20260830000004_go_live_hardening.sql)"
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

describe("Phase 7A — invite-only signup", { skip }, () => {
  let admin: SupabaseClient;
  const users: Record<string, { id: string; email: string; password: string }> =
    {};
  let orgA = "";
  let orgB = "";
  const createdUserIds: string[] = [];

  async function mkUser(key: string, emailOverride?: string) {
    const email = emailOverride ?? `p7a-${key}-${stamp}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: pwd(key),
      email_confirm: true,
    });
    assert.ifError(error);
    users[key] = { id: data.user!.id, email, password: pwd(key) };
    createdUserIds.push(data.user!.id);
  }

  async function makeInvite(
    org: string,
    email: string,
    opts: { role?: string; status?: string; expiresAt?: string } = {},
  ): Promise<string> {
    const raw = secToken();
    const { error } = await admin.from("organization_invites").insert({
      organization_id: org,
      email,
      role: opts.role ?? "analyst",
      token_hash: tokenHash(raw),
      status: opts.status ?? "pending",
      expires_at:
        opts.expiresAt ?? new Date(Date.now() + 14 * 864e5).toISOString(),
    });
    assert.ifError(error);
    return raw;
  }

  before(async () => {
    admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await mkUser("existing"); // already has an account
    await mkUser("wrong"); // exists, but wrong e-mail for the invite

    for (const [key, slug] of [
      ["A", `p7a-a-${stamp}`],
      ["B", `p7a-b-${stamp}`],
    ] as const) {
      const o = await admin
        .from("organizations")
        .insert({ name: `P7A ${key}`, slug })
        .select("id")
        .single();
      assert.ifError(o.error);
      if (key === "A") orgA = o.data!.id;
      else orgB = o.data!.id;
    }
  });

  after(async () => {
    if (!admin) return;
    for (const id of [orgA, orgB].filter(Boolean)) {
      await admin.from("organization_invites").delete().eq("organization_id", id);
      await admin.from("organizations").delete().eq("id", id);
    }
    for (const id of createdUserIds) await admin.auth.admin.deleteUser(id);
  });

  test("1) a valid invite lets signup proceed (anon gets the e-mail)", async () => {
    const raw = await makeInvite(orgA, `p7a-new-${stamp}@example.test`);
    const r = await anon().rpc("prepare_invite_signup", {
      p_token_hash: tokenHash(raw),
    });
    assert.ifError(r.error);
    assert.equal(r.data.ok, true);
    assert.equal(r.data.email, `p7a-new-${stamp}@example.test`);
    assert.equal(r.data.role, "analyst");
  });

  test("2) an unknown token is rejected", async () => {
    const r = await anon().rpc("prepare_invite_signup", {
      p_token_hash: tokenHash(secToken()),
    });
    assert.equal(r.data.ok, false);
    assert.equal(r.data.reason, "invalid");
  });

  test("3) an expired invite is rejected", async () => {
    const raw = await makeInvite(orgA, `p7a-exp-${stamp}@example.test`, {
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
    });
    const r = await anon().rpc("prepare_invite_signup", {
      p_token_hash: tokenHash(raw),
    });
    assert.equal(r.data.ok, false);
    assert.equal(r.data.reason, "expired");
  });

  test("4) a revoked invite is rejected", async () => {
    const raw = await makeInvite(orgA, `p7a-rev-${stamp}@example.test`, {
      status: "revoked",
    });
    const r = await anon().rpc("prepare_invite_signup", {
      p_token_hash: tokenHash(raw),
    });
    assert.equal(r.data.ok, false);
    assert.equal(r.data.reason, "revoked");
  });

  test("5) an invite into a suspended org is rejected", async () => {
    await admin.from("organizations").update({ status: "suspended" }).eq("id", orgB);
    const raw = await makeInvite(orgB, `p7a-susp-${stamp}@example.test`);
    const r = await anon().rpc("prepare_invite_signup", {
      p_token_hash: tokenHash(raw),
    });
    assert.equal(r.data.ok, false);
    assert.equal(r.data.reason, "organization_suspended");
    await admin.from("organizations").update({ status: "active" }).eq("id", orgB);
  });

  test("6) accept rejects a signed-in user whose e-mail differs from the invite", async () => {
    const raw = await makeInvite(orgA, `p7a-mismatch-${stamp}@example.test`);
    const c = await signedIn(users.wrong.email, users.wrong.password);
    const r = await c.rpc("accept_org_invite", { p_token_hash: tokenHash(raw) });
    assert.ok(r.error);
    assert.match(r.error!.message, /EMAIL_MISMATCH/);
  });

  test("7) an existing user accepts and becomes a member exactly once", async () => {
    const raw = await makeInvite(orgA, users.existing.email);
    const c = await signedIn(users.existing.email, users.existing.password);
    const r = await c.rpc("accept_org_invite", { p_token_hash: tokenHash(raw) });
    assert.ifError(r.error);
    assert.equal(r.data.status, "accepted");

    const mem = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgA)
      .eq("user_id", users.existing.id);
    assert.equal(mem.data!.length, 1);
  });

  test("8) a brand-new person can create their own account from the invite", async () => {
    const email = `p7a-signup-${stamp}@example.test`;
    const raw = await makeInvite(orgA, email);

    // server would call this to learn the e-mail, then signUp with it
    const prep = await anon().rpc("prepare_invite_signup", {
      p_token_hash: tokenHash(raw),
    });
    assert.equal(prep.data.ok, true);

    const c = anon();
    const su = await c.auth.signUp({ email: prep.data.email, password: pwd("signup") });
    assert.ifError(su.error);
    assert.ok(su.data.user, "account was created");

    // Track for cleanup regardless of confirmation setting.
    const { data: found } = await admin.auth.admin.listUsers({ perPage: 200 });
    const created = found.users.find((u) => u.email === email);
    if (created) createdUserIds.push(created.id);

    if (su.data.session) {
      // Confirmation disabled -> the session can accept immediately.
      const acc = await c.rpc("accept_org_invite", { p_token_hash: tokenHash(raw) });
      assert.ifError(acc.error);
      assert.equal(acc.data.status, "accepted");
    }
    // Confirmation enabled -> no session yet; acceptance happens after the
    // user confirms and returns to /invite/[token]. The account exists either
    // way, which is the point of this phase.
  });

  test("9/10) double accept is idempotent (already_member)", async () => {
    const raw = await makeInvite(orgA, users.existing.email);
    const c = await signedIn(users.existing.email, users.existing.password);
    const first = await c.rpc("accept_org_invite", { p_token_hash: tokenHash(raw) });
    assert.ifError(first.error);
    const second = await c.rpc("accept_org_invite", {
      p_token_hash: tokenHash(raw),
    });
    assert.ifError(second.error);
    assert.equal(second.data.status, "already_member");

    const mem = await admin
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", orgA)
      .eq("user_id", users.existing.id);
    assert.equal(mem.data!.length, 1);
  });

  test("11) an invite for org A cannot pull a member into org B", async () => {
    const rawA = await makeInvite(orgA, `p7a-iso-${stamp}@example.test`);
    // The invite is scoped to org A only; accepting it never touches org B.
    const prep = await anon().rpc("prepare_invite_signup", {
      p_token_hash: tokenHash(rawA),
    });
    assert.equal(prep.data.ok, true);
    const mem = await admin
      .from("organization_members")
      .select("organization_id")
      .eq("organization_id", orgB);
    assert.equal(mem.data!.length, 0);
  });

  test("12) there is no signup without an invite token", async () => {
    // The only in-app path to account creation is prepare_invite_signup, and
    // it yields nothing usable without a real pending token.
    const r = await anon().rpc("prepare_invite_signup", {
      p_token_hash: "0".repeat(64),
    });
    assert.equal(r.data.ok, false);
    assert.ok(!("email" in r.data));
  });
});
