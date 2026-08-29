/**
 * FASE 3B — Evidence Layer against a real Supabase (§66).
 *
 * Exercises the snapshot RPCs directly (no Claude): server-side median/average,
 * validation, RLS / cross-tenant isolation, the latest-snapshot view, timeline
 * events, provenance, and that a snapshot never touches
 * `creator_social_profiles`. Skips if migration 20260828000004 is not applied.
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
  const t = await probe.from("social_metric_snapshots").select("id").limit(1);
  const f = await probe.rpc("evidence_stats");
  ready = !t.error && !f.error;
}

const skip = !configured
  ? "Supabase credentials not set"
  : !ready
    ? "Phase 3B schema not applied (run supabase/migrations/20260828000004_evidence_enrichment.sql)"
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

describe("Phase 3B — Evidence Layer", { skip }, () => {
  let admin: SupabaseClient;
  let orgA = "";
  let orgB = "";
  let creatorId = "";
  let profileId = "";
  let appId = "";
  const users: Record<string, { id: string; email: string; password: string }> =
    {};

  async function mkUser(key: string) {
    const email = `p3b-${key}-${stamp}@example.test`;
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
    await mkUser("ownerB");

    const orgs = await admin
      .from("organizations")
      .insert([
        { name: "P3B A", slug: `p3b-a-${stamp}` },
        { name: "P3B B", slug: `p3b-b-${stamp}` },
      ])
      .select("id, slug");
    assert.ifError(orgs.error);
    orgA = orgs.data!.find((o) => o.slug === `p3b-a-${stamp}`)!.id;
    orgB = orgs.data!.find((o) => o.slug === `p3b-b-${stamp}`)!.id;

    await admin.from("organization_members").insert([
      { organization_id: orgA, user_id: users.ownerA.id, role: "owner" },
      { organization_id: orgB, user_id: users.ownerB.id, role: "owner" },
    ]);

    await admin
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

    const sub = await anon().rpc("submit_application", {
      p_org_slug: `p3b-a-${stamp}`,
      p_program_slug: "creators",
      p_form_version: 1,
      p_answers: { full_name: "Teste 3B" },
      p_field_snapshot: [
        { field_key: "full_name", label: "Nome", field_type: "text" },
      ],
      p_creator: { full_name: "Teste 3B" },
      p_socials: [],
      p_utm: {},
      p_referrer: null,
      p_source: null,
    });
    assert.ifError(sub.error);
    appId = sub.data.application_id;

    const appRow = await admin
      .from("applications")
      .select("creator_id")
      .eq("id", appId)
      .single();
    creatorId = appRow.data!.creator_id;

    const prof = await admin
      .from("creator_social_profiles")
      .insert({
        organization_id: orgA,
        creator_id: creatorId,
        platform: "instagram",
        handle: "@teste3b",
        handle_normalized: "teste3b",
        followers_declared: 40000,
        average_views_declared: 5000,
      })
      .select("id")
      .single();
    assert.ifError(prof.error);
    profileId = prof.data!.id;
  });

  after(async () => {
    if (!admin) return;
    await admin
      .from("social_metric_snapshots")
      .delete()
      .in("organization_id", [orgA, orgB]);
    await admin.from("creator_analyses").delete().in("organization_id", [orgA, orgB]);
    await admin.from("applications").delete().in("organization_id", [orgA, orgB]);
    await admin.from("creator_events").delete().in("organization_id", [orgA, orgB]);
    await admin
      .from("creator_social_profiles")
      .delete()
      .in("organization_id", [orgA, orgB]);
    await admin.from("organizations").delete().in("id", [orgA, orgB]);
    for (const u of Object.values(users)) {
      await admin.auth.admin.deleteUser(u.id);
    }
  });

  test("1) create_metric_snapshot computes median/average server-side from the sample", async () => {
    const owner = await signedIn(users.ownerA.email, users.ownerA.password);
    const res = await owner.rpc("create_metric_snapshot", {
      p_social_profile_id: profileId,
      p_payload: {
        source: "admin_manual",
        observed_at: "2026-08-01T00:00:00.000Z",
        followers: 41000,
        period_days: 30,
        posts_count: 12,
        views_sample: [10, 20, 30, 40],
        // a lie the client tries to sneak in — must be ignored:
        median_views: 999999,
        average_views: 999999,
      },
    });
    assert.ifError(res.error);
    assert.equal(res.data.ok, true);
    assert.equal(Number(res.data.median_views), 25); // (20+30)/2
    assert.equal(Number(res.data.average_views), 25); // (10+20+30+40)/4

    const row = await admin
      .from("social_metric_snapshots")
      .select("*")
      .eq("id", res.data.snapshot_id)
      .single();
    assert.equal(Number(row.data!.median_views), 25);
    assert.equal(Number(row.data!.average_views), 25);
    assert.equal(row.data!.organization_id, orgA); // derived from the profile
    assert.equal(row.data!.creator_id, creatorId);
    assert.equal(row.data!.created_by, users.ownerA.id);
  });

  test("2) odd-length sample -> exact middle; 3) declared followers untouched", async () => {
    const owner = await signedIn(users.ownerA.email, users.ownerA.password);
    const res = await owner.rpc("create_metric_snapshot", {
      p_social_profile_id: profileId,
      p_payload: {
        source: "admin_manual",
        observed_at: "2026-08-10T00:00:00.000Z",
        followers: 42000,
        views_sample: [10, 20, 30],
      },
    });
    assert.ifError(res.error);
    assert.equal(Number(res.data.median_views), 20);

    const prof = await admin
      .from("creator_social_profiles")
      .select("followers_declared, average_views_declared")
      .eq("id", profileId)
      .single();
    assert.equal(prof.data!.followers_declared, 40000); // NEVER overwritten (§15)
    assert.equal(prof.data!.average_views_declared, 5000);
  });

  test("4) sample larger than 30 is rejected", async () => {
    const owner = await signedIn(users.ownerA.email, users.ownerA.password);
    const res = await owner.rpc("create_metric_snapshot", {
      p_social_profile_id: profileId,
      p_payload: {
        source: "admin_manual",
        views_sample: Array.from({ length: 31 }, (_, i) => i + 1),
      },
    });
    assert.ok(res.error);
    assert.match(res.error!.message, /SAMPLE_TOO_LARGE/);
  });

  test("5) observed_at far in the future is rejected", async () => {
    const owner = await signedIn(users.ownerA.email, users.ownerA.password);
    const res = await owner.rpc("create_metric_snapshot", {
      p_social_profile_id: profileId,
      p_payload: {
        source: "admin_manual",
        observed_at: "2999-01-01T00:00:00.000Z",
        followers: 1,
      },
    });
    assert.ok(res.error);
    assert.match(res.error!.message, /OBSERVED_AT_FUTURE/);
  });

  test("6) a member of another org cannot create a snapshot for this profile", async () => {
    const outsider = await signedIn(users.ownerB.email, users.ownerB.password);
    const res = await outsider.rpc("create_metric_snapshot", {
      p_social_profile_id: profileId,
      p_payload: { source: "admin_manual", followers: 1 },
    });
    assert.ok(res.error);
    assert.match(res.error!.message, /FORBIDDEN/);
  });

  test("7) RLS: org B owner cannot read org A snapshots", async () => {
    const outsider = await signedIn(users.ownerB.email, users.ownerB.password);
    const rows = await outsider
      .from("social_metric_snapshots")
      .select("id")
      .eq("organization_id", orgA);
    assert.ifError(rows.error);
    assert.equal(rows.data!.length, 0);
  });

  test("8) latest_metric_snapshots returns the newest observation per profile", async () => {
    const owner = await signedIn(users.ownerA.email, users.ownerA.password);
    const view = await owner
      .from("latest_metric_snapshots")
      .select("observed_at, followers")
      .eq("social_profile_id", profileId)
      .maybeSingle();
    assert.ifError(view.error);
    assert.equal(view.data!.observed_at, "2026-08-10T00:00:00+00:00");
    assert.equal(view.data!.followers, 42000);
  });

  test("9) update_metric_snapshot recomputes median and logs an event", async () => {
    const owner = await signedIn(users.ownerA.email, users.ownerA.password);
    const created = await owner.rpc("create_metric_snapshot", {
      p_social_profile_id: profileId,
      p_payload: {
        source: "admin_manual",
        observed_at: "2026-07-01T00:00:00.000Z",
        views_sample: [100, 200, 300],
      },
    });
    assert.ifError(created.error);
    assert.equal(Number(created.data.median_views), 200);

    const updated = await owner.rpc("update_metric_snapshot", {
      p_snapshot_id: created.data.snapshot_id,
      p_payload: {
        source: "admin_manual",
        observed_at: "2026-07-01T00:00:00.000Z",
        views_sample: [10, 90],
      },
    });
    assert.ifError(updated.error);
    assert.equal(Number(updated.data.median_views), 50);

    const events = await admin
      .from("creator_events")
      .select("type, data")
      .eq("creator_id", creatorId)
      .in("type", ["metric_snapshot_added", "metric_snapshot_updated"]);
    assert.ifError(events.error);
    const types = events.data!.map((e) => e.type);
    assert.ok(types.includes("metric_snapshot_added"));
    assert.ok(types.includes("metric_snapshot_updated"));
    // minimal, PII-free metadata
    const added = events.data!.find((e) => e.type === "metric_snapshot_added")!;
    assert.deepEqual(
      Object.keys(added.data as Record<string, unknown>).sort(),
      ["observed_at", "platform", "snapshot_id", "social_profile_id", "source"],
    );
  });

  test("10) multiple snapshots on the same date are allowed (source differentiates)", async () => {
    const owner = await signedIn(users.ownerA.email, users.ownerA.password);
    for (const source of ["admin_manual", "creator_provided"]) {
      const res = await owner.rpc("create_metric_snapshot", {
        p_social_profile_id: profileId,
        p_payload: {
          source,
          observed_at: "2026-06-15T00:00:00.000Z",
          followers: 39000,
        },
      });
      assert.ifError(res.error);
    }
    const rows = await admin
      .from("social_metric_snapshots")
      .select("id")
      .eq("social_profile_id", profileId)
      .eq("observed_at", "2026-06-15T00:00:00+00:00");
    assert.equal(rows.data!.length, 2);
  });

  test("11) empty snapshot (no metric at all) is rejected by the table constraint", async () => {
    const owner = await signedIn(users.ownerA.email, users.ownerA.password);
    const res = await owner.rpc("create_metric_snapshot", {
      p_social_profile_id: profileId,
      p_payload: { source: "admin_manual", observed_at: "2026-05-01T00:00:00.000Z" },
    });
    assert.ok(res.error, "an all-null snapshot must not be inserted");
  });

  test("12) evidence_stats counts snapshots, creators and multi-snapshot profiles", async () => {
    const owner = await signedIn(users.ownerA.email, users.ownerA.password);
    const res = await owner.rpc("evidence_stats");
    assert.ifError(res.error);
    assert.ok(Number(res.data.snapshots) >= 5);
    assert.ok(Number(res.data.creators_with_snapshot) >= 1);
    assert.ok(Number(res.data.profiles_multi_snapshot) >= 1);
  });

  test("13) complete_creator_analysis persists used_snapshot_ids", async () => {
    const owner = await signedIn(users.ownerA.email, users.ownerA.password);
    const snap = await owner.rpc("create_metric_snapshot", {
      p_social_profile_id: profileId,
      p_payload: {
        source: "admin_manual",
        observed_at: "2026-04-01T00:00:00.000Z",
        followers: 38000,
      },
    });
    assert.ifError(snap.error);

    const started = await owner.rpc("start_creator_analysis", {
      p_application_id: appId,
      p_provider: "test",
      p_model: "test-model",
      p_prompt_version: "creator-analysis-v2",
      p_scoring_version: "creator-score-v1",
    });
    assert.ifError(started.error);
    const analysisId = started.data.analysis_id;

    const done = await owner.rpc("complete_creator_analysis", {
      p_analysis_id: analysisId,
      p_result: {
        model: "test-model",
        score: 70,
        tier: "B",
        confidence: "medium",
        evidence_coverage: 0.3,
        subscores: {},
        summary: "s",
        strengths: [],
        attention_points: [],
        suggested_tags: [],
        input_snapshot: {},
        raw_result: { criteria: {} },
        used_snapshot_ids: [snap.data.snapshot_id],
        input_tokens: 1,
        output_tokens: 1,
        latency_ms: 1,
      },
    });
    assert.ifError(done.error);

    const row = await admin
      .from("creator_analyses")
      .select("used_snapshot_ids, scoring_version, prompt_version")
      .eq("id", analysisId)
      .single();
    assert.deepEqual(row.data!.used_snapshot_ids, [snap.data.snapshot_id]);
    assert.equal(row.data!.scoring_version, "creator-score-v1");
    assert.equal(row.data!.prompt_version, "creator-analysis-v2");
  });

  test("14) anon cannot read the snapshots table at all", async () => {
    const rows = await anon().from("social_metric_snapshots").select("id");
    // RLS with no anon policy -> empty (or error); never data.
    assert.ok(rows.error || (rows.data && rows.data.length === 0));
  });
});
