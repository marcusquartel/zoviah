import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQualitative } from "../src/features/analysis/qualitative-schema.ts";

const base = {
  summary: "Perfil de skincare com temas claros.",
  strengths: ["Nicho definido"],
  attention_points: ["Sem métricas de performance"],
  suggested_tags: ["skincare", "beleza"],
  criteria: {
    content_quality: {
      score: null,
      coverage: 0,
      evidence_status: "insufficient",
      rationale: "Só links.",
      evidence_used: [],
    },
    communication: {
      score: null,
      coverage: 0,
      evidence_status: "insufficient",
      rationale: "Sem vídeo.",
      evidence_used: [],
    },
    brand_affinity: {
      score: 82,
      coverage: 1,
      evidence_status: "sufficient",
      rationale: "Temas compatíveis.",
      evidence_used: ["content_topics"],
    },
  },
};

test("accepts a well-formed result", () => {
  const r = parseQualitative(JSON.stringify(base));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.criteria.brand_affinity.score, 82);
    assert.equal(r.data.criteria.content_quality.score, null);
  }
});

test("strips markdown fences", () => {
  const r = parseQualitative("```json\n" + JSON.stringify(base) + "\n```");
  assert.equal(r.ok, true);
});

test("rejects non-JSON", () => {
  const r = parseQualitative("desculpe, não posso ajudar");
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.error, "invalid_json");
});

test("score out of 0-100 is coerced to null (never trusted)", () => {
  const bad = structuredClone(base);
  bad.criteria.brand_affinity.score = 250;
  const r = parseQualitative(JSON.stringify(bad));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.criteria.brand_affinity.score, null);
});

test("coverage out of 0-1 is coerced to 0", () => {
  const bad = structuredClone(base);
  bad.criteria.brand_affinity.coverage = 9;
  const r = parseQualitative(JSON.stringify(bad));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.criteria.brand_affinity.coverage, 0);
});

test("invalid evidence_status falls back to insufficient", () => {
  const bad = structuredClone(base);
  bad.criteria.brand_affinity.evidence_status = "amazing";
  const r = parseQualitative(JSON.stringify(bad));
  assert.equal(r.ok, true);
  if (r.ok)
    assert.equal(r.data.criteria.brand_affinity.evidence_status, "insufficient");
});

test("more than 8 tags are truncated to 8", () => {
  const many = structuredClone(base);
  many.suggested_tags = Array.from({ length: 20 }, (_, i) => `tag${i}`);
  const r = parseQualitative(JSON.stringify(many));
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.data.suggested_tags.length, 8);
});

test("more than 5 strengths / attention_points are truncated to 5", () => {
  const many = structuredClone(base);
  many.strengths = Array.from({ length: 9 }, (_, i) => `s${i}`);
  many.attention_points = Array.from({ length: 9 }, (_, i) => `a${i}`);
  const r = parseQualitative(JSON.stringify(many));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.data.strengths.length, 5);
    assert.equal(r.data.attention_points.length, 5);
  }
});

test("missing a required criterion is rejected", () => {
  const missing = structuredClone(base) as Record<string, unknown>;
  delete (missing.criteria as Record<string, unknown>).communication;
  const r = parseQualitative(JSON.stringify(missing));
  assert.equal(r.ok, false);
});

test("forbidden top-level fields (overall_score, tier, confidence, approval) are ignored", () => {
  const injected = {
    ...base,
    overall_score: 100,
    tier: "A",
    confidence: "high",
    approval: "approved",
  };
  const r = parseQualitative(JSON.stringify(injected));
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.ok(!("overall_score" in r.data));
    assert.ok(!("tier" in r.data));
    assert.ok(!("confidence" in r.data));
    assert.ok(!("approval" in r.data));
  }
});

test("a null score cannot claim high coverage", () => {
  const sneaky = structuredClone(base);
  sneaky.criteria.content_quality.score = null;
  sneaky.criteria.content_quality.coverage = 1;
  const r = parseQualitative(JSON.stringify(sneaky));
  assert.equal(r.ok, true);
  if (r.ok)
    assert.ok(r.data.criteria.content_quality.coverage <= 0.4);
});
