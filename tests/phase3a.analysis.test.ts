/**
 * Phase 3A — creator_analyses: RLS, roles, concurrency, cache, history.
 * Real Supabase. Does NOT call Claude — the RPCs are exercised directly with
 * fabricated results. Skips if migration 20260828000003 is not applied.
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
  const t = await probe.from("creator_analyses").select("id").limit(1);
  const f = await probe.rpc("analysis_stats");
  ready = !t.error && !f.error;
}

const skip = !configured
  ? "Supabase credentials not set"
  : !ready
    ? "Phase 3A schema not applied (run supabase/migrations/20260828000003_creator_analysis.sql)"
    : false;

const stamp = Date.now();
const pwd = (p: string) => `${p}1!${stamp}zz`;

function client(): SupabaseClient {
  return createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
// Memoized: one auth call per user for the whole file (keeps the shared
// project's auth rate limit happy when the full suite runs).
const _signedIn = new Map<string, SupabaseClient>();
async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const hit = _signedIn.get(email);
  if (hit) return hit;
  const c = client();
  assert.ifError((await c.auth.signInWithPassword({ email, password })).error);
  _signedIn.set(email, c);
  return c;
}

function fakeResult(score: number | null) {
  return {
    model: "test-model",
    score,
    tier: score == null ? null : score >= 85 ? "A" : score >= 70 ? "B" : "C",
    confidence: score == null ? "low" : "medium",
    evidence_coverage: score == null ? 0 : 0.3,
    subscores: { professionalism: { score, weight: 5 } },
    summary: "resumo de teste",
    strengths: ["x"],
    attention_points: ["y"],
    suggested_tags: ["t"],
    input_snapshot: { program: { name: "p" } },
    raw_result: { criteria: {} },
    input_tokens: 100,
    output_tokens: 50,
    latency_ms: 1234,
  };
}

describe("Phase 3A — creator analysis", { skip }, () => {
  let admin: SupabaseClient;
  let orgA = "";
  let orgB = "";
  const users: Record<string, { id: string; email: string; password: string }> =
    {};
  let appId = "";

  async function mkUser(key: string) {
    const email = `p3-${key}-${stamp}@example.test`;
    const password = pwd(key);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.ifError(error);
    users[key] = { id: data.user!.id, email, password };
  }

  before(async () => {
    admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await mkUser("ownerA");
    await mkUser("analystA");
    await mkUser("ownerB");

    const orgs = await admin
      .from("organizations")
      .insert([
        { name: "P3 A", slug: `p3-a-${stamp}` },
        { name: "P3 B", slug: `p3-b-${stamp}` },
      ])
      .select("id, slug");
    assert.ifError(orgs.error);
    orgA = orgs.data!.find((o) => o.slug === `p3-a-${stamp}`)!.id;
    orgB = orgs.data!.find((o) => o.slug === `p3-b-${stamp}`)!.id;

    await admin.from("organization_members").insert([
      { organization_id: orgA, user_id: users.ownerA.id, role: "owner" },
      { organization_id: orgA, user_id: users.analystA.id, role: "analyst" },
      { organization_id: orgB, user_id: users.ownerB.id, role: "owner" },
    ]);

    const prog = await admin
      .from("programs")
      .insert({
        organization_id: orgA,
        name: "A",
        slug: "creators",
        status: "active",
        form_version: 1,
      })
      .select("id")
      .single();
    await admin.from("form_fields").insert({
      organization_id: orgA,
      program_id: prog.data!.id,
      field_key: "full_name",
      label: "Nome",
      field_type: "text",
      required: true,
      position: 0,
      configuration: { mapping: "full_name" },
    });

    const sub = await client().rpc("submit_application", {
      p_org_slug: `p3-a-${stamp}`,
      p_program_slug: "creators",
      p_form_version: 1,
      p_answers: { full_name: "Teste P3" },
      p_field_snapshot: [
        { field_key: "full_name", label: "Nome", field_type: "text" },
      ],
      p_creator: { full_name: "Teste P3" },
      p_socials: [],
      p_utm: {},
      p_referrer: null,
      p_source: null,
    });
    assert.ifError(sub.error);
    appId = sub.data.application_id;
  });

  after(async () => {
    if (!admin) return;
    await admin.from("creator_analyses").delete().in("organization_id", [orgA, orgB]);
    await admin.from("applications").delete().in("organization_id", [orgA, orgB]);
    await admin.from("creator_events").delete().in("organization_id", [orgA, orgB]);
    await admin.from("organizations").delete().in("id", [orgA, orgB]);
    for (const u of Object.values(users)) {
      await admin.auth.admin.deleteUser(u.id);
    }
  });

  test("1/2/3) A owner + analyst see A's analyses; B does not", async () => {
    // seed one completed analysis via the RPCs as owner A
    const owner = await signedIn(users.ownerA.email, users.ownerA.password);
    const started = await owner.rpc("start_creator_analysis", {
      p_application_id: appId,
      p_provider: "test",
      p_model: "test-model",
      p_prompt_version: "creator-analysis-v1",
      p_scoring_version: "creator-score-v1",
    });
    assert.ifError(started.error);
    const id = started.data.analysis_id;
    assert.ifError(
      (await owner.rpc("complete_creator_analysis", {
        p_analysis_id: id,
        p_result: fakeResult(78),
      })).error,
    );

    for (const key of ["ownerA", "analystA"] as const) {
      const c = await signedIn(users[key].email, users[key].password);
      const { data, error } = await c
        .from("creator_analyses")
        .select("id")
        .eq("organization_id", orgA);
      assert.ifError(error);
      assert.ok(data!.some((r) => r.id === id), `${key} should see analysis`);
    }

    const outsider = await signedIn(users.ownerB.email, users.ownerB.password);
    const leak = await outsider
      .from("creator_analyses")
      .select("id")
      .eq("organization_id", orgA);
    assert.ifError(leak.error);
    assert.equal(leak.data!.length, 0);
  });

  test("4) tenant B cannot start an analysis on A's application", async () => {
    const outsider = await signedIn(users.ownerB.email, users.ownerB.password);
    const { error } = await outsider.rpc("start_creator_analysis", {
      p_application_id: appId,
      p_provider: "test",
      p_model: "m",
      p_prompt_version: "v1",
      p_scoring_version: "v1",
    });
    assert.ok(error);
    assert.match(error!.message, /FORBIDDEN/);
  });

  test("5/6) analyst A can start + complete; application cache updates", async () => {
    const analyst = await signedIn(users.analystA.email, users.analystA.password);
    const started = await analyst.rpc("start_creator_analysis", {
      p_application_id: appId,
      p_provider: "test",
      p_model: "test-model",
      p_prompt_version: "creator-analysis-v1",
      p_scoring_version: "creator-score-v1",
    });
    assert.ifError(started.error);
    const id = started.data.analysis_id;

    // while processing the app cache says 'processing' and score is untouched
    const processing = await admin
      .from("applications")
      .select("analysis_status")
      .eq("id", appId)
      .single();
    assert.equal(processing.data!.analysis_status, "processing");

    assert.ifError(
      (await analyst.rpc("complete_creator_analysis", {
        p_analysis_id: id,
        p_result: fakeResult(91),
      })).error,
    );

    const done = await admin
      .from("applications")
      .select(
        "analysis_status, current_score, current_tier, current_analysis_id, analysis_confidence, analysis_coverage",
      )
      .eq("id", appId)
      .single();
    assert.equal(done.data!.analysis_status, "completed");
    assert.equal(done.data!.current_score, 91);
    assert.equal(done.data!.current_tier, "A");
    assert.equal(done.data!.current_analysis_id, id);
    assert.equal(done.data!.analysis_confidence, "medium");
  });

  test("7) reanalysis creates a NEW row; previous stays; current points to newest completed", async () => {
    const owner = await signedIn(users.ownerA.email, users.ownerA.password);
    const before = await admin
      .from("creator_analyses")
      .select("id", { count: "exact", head: true })
      .eq("application_id", appId);

    const started = await owner.rpc("start_creator_analysis", {
      p_application_id: appId,
      p_provider: "test",
      p_model: "test-model",
      p_prompt_version: "creator-analysis-v1",
      p_scoring_version: "creator-score-v1",
    });
    assert.ifError(started.error);
    const newId = started.data.analysis_id;
    assert.ifError(
      (await owner.rpc("complete_creator_analysis", {
        p_analysis_id: newId,
        p_result: fakeResult(60),
      })).error,
    );

    const afterCount = await admin
      .from("creator_analyses")
      .select("id", { count: "exact", head: true })
      .eq("application_id", appId);
    assert.equal((afterCount.count ?? 0), (before.count ?? 0) + 1);

    const completed = await admin
      .from("creator_analyses")
      .select("id")
      .eq("application_id", appId)
      .eq("status", "completed");
    assert.ok(completed.data!.length >= 2, "old completed analyses preserved");

    const app = await admin
      .from("applications")
      .select("current_analysis_id, current_score")
      .eq("id", appId)
      .single();
    assert.equal(app.data!.current_analysis_id, newId);
    assert.equal(app.data!.current_score, 60);
  });

  test("8) a processing analysis blocks a second start", async () => {
    const owner = await signedIn(users.ownerA.email, users.ownerA.password);
    const first = await owner.rpc("start_creator_analysis", {
      p_application_id: appId,
      p_provider: "test",
      p_model: "m",
      p_prompt_version: "v1",
      p_scoring_version: "v1",
    });
    assert.ifError(first.error);

    const second = await owner.rpc("start_creator_analysis", {
      p_application_id: appId,
      p_provider: "test",
      p_model: "m",
      p_prompt_version: "v1",
      p_scoring_version: "v1",
    });
    assert.ok(second.error);
    assert.match(second.error!.message, /ANALYSIS_IN_PROGRESS/);

    // clean up: fail the processing one
    await owner.rpc("fail_creator_analysis", {
      p_analysis_id: first.data.analysis_id,
      p_error_code: "test_cleanup",
      p_error_message: "cleanup",
    });
  });

  test("9) a failed analysis does NOT wipe the previous completed cache", async () => {
    const owner = await signedIn(users.ownerA.email, users.ownerA.password);
    const appBefore = await admin
      .from("applications")
      .select("current_analysis_id, current_score, current_tier")
      .eq("id", appId)
      .single();

    const started = await owner.rpc("start_creator_analysis", {
      p_application_id: appId,
      p_provider: "test",
      p_model: "m",
      p_prompt_version: "v1",
      p_scoring_version: "v1",
    });
    assert.ifError(started.error);
    assert.ifError(
      (await owner.rpc("fail_creator_analysis", {
        p_analysis_id: started.data.analysis_id,
        p_error_code: "timeout",
        p_error_message: "boom",
      })).error,
    );

    const appAfter = await admin
      .from("applications")
      .select("current_analysis_id, current_score, current_tier, analysis_status")
      .eq("id", appId)
      .single();
    assert.equal(appAfter.data!.analysis_status, "failed");
    assert.equal(appAfter.data!.current_analysis_id, appBefore.data!.current_analysis_id);
    assert.equal(appAfter.data!.current_score, appBefore.data!.current_score);
    assert.equal(appAfter.data!.current_tier, appBefore.data!.current_tier);
  });

  test("10) analysis_completed events land only in the right org; stats are scoped", async () => {
    const events = await admin
      .from("creator_events")
      .select("organization_id, type")
      .eq("application_id", appId)
      .eq("type", "analysis_completed");
    assert.ok(events.data!.length >= 1);
    assert.ok(events.data!.every((e) => e.organization_id === orgA));

    const outsider = await signedIn(users.ownerB.email, users.ownerB.password);
    const stats = await outsider.rpc("analysis_stats");
    assert.ifError(stats.error);
    // org B has no analyses
    assert.equal(stats.data.completed, 0);
    assert.equal(stats.data.failed, 0);
  });
});
