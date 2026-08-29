/**
 * Phase 3A — ONE real Anthropic call (§80). Runs only when ANTHROPIC_API_KEY
 * and ANTHROPIC_MODEL are set. Uses a synthetic tenant + application — never
 * the real creators. One paid call, then cleanup.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  runQualitativeAnalysis,
} from "../src/lib/anthropic/creator-analysis.ts";
import { buildClaudePayload } from "../src/features/analysis/sanitize.ts";
import { computeObjectiveCriteria } from "../src/features/analysis/objective.ts";
import { combineAnalysis } from "../src/features/analysis/analyze.ts";

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
const anthropicReady = Boolean(
  process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_MODEL,
);
const supaReady = Boolean(url && anonKey && serviceKey);

let schemaReady = false;
if (supaReady) {
  const probe = createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  schemaReady = !(await probe.from("creator_analyses").select("id").limit(1))
    .error;
}

const skip = !anthropicReady
  ? "ANTHROPIC_API_KEY / ANTHROPIC_MODEL not set"
  : !supaReady || !schemaReady
    ? "Supabase / Phase 3A schema not ready"
    : false;

const evidence = {
  program: { name: "Programa Beleza", purpose: null },
  contentTopics: ["skincare", "maquiagem", "resenhas"],
  partnershipInfo: { "Como trabalha com marcas?": "recebidos e permuta" },
  relevantAnswers: {
    "Fale sobre você":
      "Produzo conteúdo educativo de skincare há 3 anos, foco em pele sensível.",
  },
  declaredMetrics: {
    instagram_followers: 25000,
    instagram_avg_views: 4000,
    tiktok_followers: null,
    tiktok_avg_views: null,
  },
  contentLinks: ["https://instagram.com/p/abc"],
  registration: {
    hasName: true,
    hasEmail: true,
    hasPhone: true,
    hasCity: true,
    hasState: true,
  },
  socialHandles: [
    { platform: "instagram", handle: "synthetic_handle", plausible: true },
  ],
  socialMetrics: {},
};

describe("Phase 3A — Anthropic smoke", { skip }, () => {
  let admin: SupabaseClient;
  let orgId = "";
  let userId = "";
  let appId = "";
  const stamp = Date.now();

  before(async () => {
    admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const u = await admin.auth.admin.createUser({
      email: `smoke-${stamp}@example.test`,
      password: `Ss1!${stamp}zz`,
      email_confirm: true,
    });
    userId = u.data.user!.id;
    const org = await admin
      .from("organizations")
      .insert({ name: "Smoke", slug: `smoke-${stamp}` })
      .select("id")
      .single();
    orgId = org.data!.id;
    await admin
      .from("organization_members")
      .insert({ organization_id: orgId, user_id: userId, role: "owner" });
    const prog = await admin
      .from("programs")
      .insert({
        organization_id: orgId,
        name: "Smoke Prog",
        slug: "creators",
        status: "active",
        form_version: 1,
      })
      .select("id")
      .single();
    await admin.from("form_fields").insert({
      organization_id: orgId,
      program_id: prog.data!.id,
      field_key: "full_name",
      label: "Nome",
      field_type: "text",
      required: true,
      position: 0,
      configuration: { mapping: "full_name" },
    });
    const sub = await createClient(url!, anonKey!).rpc("submit_application", {
      p_org_slug: `smoke-${stamp}`,
      p_program_slug: "creators",
      p_form_version: 1,
      p_answers: { full_name: "Smoke" },
      p_field_snapshot: [
        { field_key: "full_name", label: "Nome", field_type: "text" },
      ],
      p_creator: { full_name: "Smoke" },
      p_socials: [],
      p_utm: {},
      p_referrer: null,
      p_source: null,
    });
    appId = sub.data.application_id;
  });

  after(async () => {
    if (!admin) return;
    await admin.from("creator_analyses").delete().eq("organization_id", orgId);
    await admin.from("applications").delete().eq("organization_id", orgId);
    await admin.from("creator_events").delete().eq("organization_id", orgId);
    await admin.from("organizations").delete().eq("id", orgId);
    await admin.auth.admin.deleteUser(userId);
  });

  test("real call -> valid structured output -> score engine -> persisted", async () => {
    const payload = buildClaudePayload(evidence);
    const qualitative = await runQualitativeAnalysis(payload);

    // structured output validated
    assert.ok(qualitative.output.criteria.brand_affinity);
    assert.ok(qualitative.output.criteria.content_quality);
    assert.ok(qualitative.output.criteria.communication);
    assert.ok(
      !("overall_score" in qualitative.output),
      "model must not return an overall score",
    );
    assert.ok(qualitative.inputTokens && qualitative.inputTokens > 0);
    assert.ok(qualitative.outputTokens && qualitative.outputTokens > 0);
    assert.ok(qualitative.latencyMs > 0);
    assert.ok(qualitative.model.length > 0);

    // deterministic engine runs
    const objective = computeObjectiveCriteria(evidence);
    const combined = combineAnalysis(objective, qualitative.output);
    assert.equal(combined.criteria.length, 8);
    assert.ok(["low", "medium", "high"].includes(combined.confidence));

    // persist through the real RPC path
    const owner = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await owner.auth.signInWithPassword({
      email: `smoke-${stamp}@example.test`,
      password: `Ss1!${stamp}zz`,
    });
    const started = await owner.rpc("start_creator_analysis", {
      p_application_id: appId,
      p_provider: "anthropic",
      p_model: qualitative.model,
      p_prompt_version: "creator-analysis-v1",
      p_scoring_version: combined.scoringVersion,
    });
    assert.ifError(started.error);
    const done = await owner.rpc("complete_creator_analysis", {
      p_analysis_id: started.data.analysis_id,
      p_result: {
        model: qualitative.model,
        score: combined.score,
        tier: combined.tier,
        confidence: combined.confidence,
        evidence_coverage: combined.evidenceCoverage,
        subscores: combined.subscores,
        summary: combined.summary,
        strengths: combined.strengths,
        attention_points: combined.attentionPoints,
        suggested_tags: combined.suggestedTags,
        input_snapshot: payload,
        raw_result: qualitative.output,
        input_tokens: qualitative.inputTokens,
        output_tokens: qualitative.outputTokens,
        latency_ms: qualitative.latencyMs,
      },
    });
    assert.ifError(done.error);

    const row = await admin
      .from("creator_analyses")
      .select("status, input_tokens, output_tokens, latency_ms, scoring_version")
      .eq("id", started.data.analysis_id)
      .single();
    assert.equal(row.data!.status, "completed");
    assert.ok(row.data!.input_tokens! > 0);
    assert.ok(row.data!.latency_ms! > 0);
    assert.equal(row.data!.scoring_version, "creator-score-v1");
  });
});
