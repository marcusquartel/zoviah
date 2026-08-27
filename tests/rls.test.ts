/**
 * Cross-tenant isolation test (Phase 0 priority check).
 *
 * Proves that a user who belongs to organization A cannot read or write
 * organization B's rows through the `authenticated` (anon key) API — RLS is
 * the enforcement boundary.
 *
 * Requires a real Supabase project. Set these in `.env.local`:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY   (server-only; used here to seed + clean up)
 *
 * The whole suite is skipped when those are absent, so `npm test` stays green
 * offline.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // no .env.local — the suite will skip below
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const configured = Boolean(url && anonKey && serviceKey);
const skip = configured
  ? false
  : "Supabase credentials not set (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)";

describe("cross-tenant isolation (RLS)", { skip }, () => {
  const stamp = Date.now();
  const passwordA = `Aa1!${stamp}aaaa`;
  const passwordB = `Bb2!${stamp}bbbb`;
  const emailA = `rls-a-${stamp}@example.test`;
  const emailB = `rls-b-${stamp}@example.test`;

  let admin: SupabaseClient;
  let userAClient: SupabaseClient;
  let userAId = "";
  let userBId = "";
  let orgAId = "";
  let orgBId = "";

  before(async () => {
    admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: a, error: aErr } = await admin.auth.admin.createUser({
      email: emailA,
      password: passwordA,
      email_confirm: true,
    });
    assert.ifError(aErr);
    userAId = a.user!.id;

    const { data: b, error: bErr } = await admin.auth.admin.createUser({
      email: emailB,
      password: passwordB,
      email_confirm: true,
    });
    assert.ifError(bErr);
    userBId = b.user!.id;

    const { data: orgs, error: orgErr } = await admin
      .from("organizations")
      .insert([
        { name: "Tenant A", slug: `tenant-a-${stamp}` },
        { name: "Tenant B", slug: `tenant-b-${stamp}` },
      ])
      .select("id, slug");
    assert.ifError(orgErr);
    orgAId = orgs!.find((o) => o.slug === `tenant-a-${stamp}`)!.id;
    orgBId = orgs!.find((o) => o.slug === `tenant-b-${stamp}`)!.id;

    const { error: memErr } = await admin.from("organization_members").insert([
      { organization_id: orgAId, user_id: userAId, role: "owner" },
      { organization_id: orgBId, user_id: userBId, role: "owner" },
    ]);
    assert.ifError(memErr);

    userAClient = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInErr } = await userAClient.auth.signInWithPassword({
      email: emailA,
      password: passwordA,
    });
    assert.ifError(signInErr);
  });

  after(async () => {
    if (orgAId) await admin.from("organizations").delete().eq("id", orgAId);
    if (orgBId) await admin.from("organizations").delete().eq("id", orgBId);
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
  });

  test("user A sees only organization A", async () => {
    const { data, error } = await userAClient
      .from("organizations")
      .select("id");
    assert.ifError(error);
    assert.deepEqual(
      data!.map((r) => r.id),
      [orgAId],
    );
  });

  test("user A cannot read organization B by id", async () => {
    const { data, error } = await userAClient
      .from("organizations")
      .select("id")
      .eq("id", orgBId);
    assert.ifError(error);
    assert.equal(data!.length, 0);
  });

  test("user A cannot read organization B's members or settings", async () => {
    const members = await userAClient
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgBId);
    assert.ifError(members.error);
    assert.equal(members.data!.length, 0);

    const settings = await userAClient
      .from("organization_settings")
      .select("organization_id")
      .eq("organization_id", orgBId);
    assert.ifError(settings.error);
    assert.equal(settings.data!.length, 0);
  });

  test("user A cannot update organization B", async () => {
    const { data } = await userAClient
      .from("organizations")
      .update({ name: "hijacked" })
      .eq("id", orgBId)
      .select("id");
    // RLS filters the row out: no rows affected, and the name is untouched.
    assert.equal(data?.length ?? 0, 0);

    const { data: check } = await admin
      .from("organizations")
      .select("name")
      .eq("id", orgBId)
      .single();
    assert.equal(check!.name, "Tenant B");
  });

  test("user A cannot insert a membership into organization B", async () => {
    const { error } = await userAClient
      .from("organization_members")
      .insert({ organization_id: orgBId, user_id: userAId, role: "admin" });
    assert.ok(error, "expected the insert to be rejected by RLS");
  });
});
