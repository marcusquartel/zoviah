/**
 * FASE 7A — public endpoint protection. Real Supabase, no Claude.
 *
 * The durable (DB-backed) rate limit for the public application form, plus a
 * re-check that anon has no unintended SELECT on the new tables. Skips until
 * migration 20260830000004 is applied.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  const f = await probe.rpc("rate_limit_public_submission", {
    p_ip_hash: "x",
  });
  ready = !f.error || !/Could not find the function/.test(f.error.message);
}

const skip = !configured
  ? "Supabase credentials not set"
  : !ready
    ? "Phase 7A schema not applied (run supabase/migrations/20260830000004_go_live_hardening.sql)"
    : false;

const stamp = Date.now();
const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

function anon(): SupabaseClient {
  return createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe("Phase 7A — public endpoint protection", { skip }, () => {
  let admin: SupabaseClient;
  const ipHashes: string[] = [];

  before(() => {
    admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  });

  after(async () => {
    if (!admin) return;
    for (const h of ipHashes) {
      await admin.from("public_submission_throttle").delete().eq("ip_hash", h);
    }
  });

  test("1) rate limit: allows up to the cap, then blocks with retry_after", async () => {
    const ipHash = sha(`p7a-rl-${stamp}-a`);
    ipHashes.push(ipHash);
    const c = anon();

    for (let i = 1; i <= 3; i += 1) {
      const r = await c.rpc("rate_limit_public_submission", {
        p_ip_hash: ipHash,
        p_max: 3,
        p_window_secs: 600,
      });
      assert.ifError(r.error);
      assert.equal(r.data.allowed, true, `call ${i} should be allowed`);
    }
    const blocked = await c.rpc("rate_limit_public_submission", {
      p_ip_hash: ipHash,
      p_max: 3,
      p_window_secs: 600,
    });
    assert.equal(blocked.data.allowed, false);
    assert.ok(blocked.data.retry_after > 0 && blocked.data.retry_after <= 600);
  });

  test("2) rate limit: distinct IP hashes have independent budgets", async () => {
    const a = sha(`p7a-rl-${stamp}-x`);
    const b = sha(`p7a-rl-${stamp}-y`);
    ipHashes.push(a, b);
    const c = anon();
    await c.rpc("rate_limit_public_submission", { p_ip_hash: a, p_max: 1, p_window_secs: 600 });
    const aBlocked = await c.rpc("rate_limit_public_submission", {
      p_ip_hash: a,
      p_max: 1,
      p_window_secs: 600,
    });
    assert.equal(aBlocked.data.allowed, false);
    const bOk = await c.rpc("rate_limit_public_submission", {
      p_ip_hash: b,
      p_max: 1,
      p_window_secs: 600,
    });
    assert.equal(bOk.data.allowed, true);
  });

  test("3) rate limit: a malformed ip hash fails open (no row written)", async () => {
    const c = anon();
    const r = await c.rpc("rate_limit_public_submission", { p_ip_hash: "not-a-hash" });
    assert.ifError(r.error);
    assert.equal(r.data.allowed, true);
    const rows = await admin
      .from("public_submission_throttle")
      .select("ip_hash")
      .eq("ip_hash", "not-a-hash");
    assert.equal(rows.data!.length, 0);
  });

  test("4) anon cannot read the throttle table directly", async () => {
    const r = await anon().from("public_submission_throttle").select("ip_hash").limit(1);
    assert.ok(!r.data || r.data.length === 0);
  });

  test("5) the public program / submission RPCs are still anon-callable", async () => {
    const c = anon();
    // get_public_program tolerates an unknown slug (returns null-ish), it must
    // not error on a permissions check.
    const gp = await c.rpc("get_public_program", {
      p_org_slug: `nope-${stamp}`,
      p_program_slug: `nope-${stamp}`,
    });
    assert.ok(!gp.error || !/permission|not.*allowed/i.test(gp.error.message));
  });
});
