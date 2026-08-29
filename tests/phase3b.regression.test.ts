/**
 * FASE 3B — the Evidence Layer must NOT change the score (§3, §46, §68).
 *
 * These tests pin `creator-score-v1`: the deterministic engine and the
 * objective criteria produce byte-for-byte the same results as before Phase 3B.
 * Only PROMPT_VERSION advanced (the system prompt now acknowledges observed
 * metrics as factual context) — SCORING_VERSION is frozen.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SCORING_VERSION,
  PROMPT_VERSION,
  CRITERION_IDS,
  CRITERIA,
  type CriterionId,
  type CriterionResult,
} from "../src/features/analysis/criteria.ts";
import { runScoreEngine } from "../src/features/analysis/score-engine.ts";
import { SYSTEM_PROMPT } from "../src/features/analysis/prompt.ts";

test("68) SCORING_VERSION is frozen at creator-score-v1", () => {
  assert.equal(SCORING_VERSION, "creator-score-v1");
});

test("47) PROMPT_VERSION advanced to creator-analysis-v2 (material prompt change)", () => {
  assert.equal(PROMPT_VERSION, "creator-analysis-v2");
});

test("weights and sources are unchanged (25/20/15/10/10/10/5/5, 5 deterministic)", () => {
  assert.deepEqual(
    CRITERION_IDS.map((id) => [id, CRITERIA[id].weight, CRITERIA[id].source]),
    [
      ["performance", 25, "deterministic"],
      ["content_quality", 20, "ai"],
      ["consistency", 15, "deterministic"],
      ["communication", 10, "ai"],
      ["brand_affinity", 10, "ai"],
      ["community_quality", 10, "deterministic"],
      ["growth_potential", 5, "deterministic"],
      ["professionalism", 5, "deterministic"],
    ],
  );
});

function crit(
  id: CriterionId,
  over: Partial<CriterionResult> = {},
): CriterionResult {
  return {
    id,
    weight: CRITERIA[id].weight,
    source: CRITERIA[id].source,
    score: null,
    coverage: 0,
    evidenceStatus: "insufficient",
    rationale: "",
    evidenceUsed: [],
    ...over,
  };
}

test("68) golden: a fixed criteria set yields the exact same v1 output", () => {
  // Realistic mid-phase state: only AI criteria + professionalism scored,
  // the 4 metric-dependent deterministic criteria still null.
  const criteria = CRITERION_IDS.map((id) => {
    switch (id) {
      case "content_quality":
        return crit(id, { score: 72, coverage: 0.8, evidenceStatus: "partial" });
      case "communication":
        return crit(id, { score: 65, coverage: 0.6, evidenceStatus: "partial" });
      case "brand_affinity":
        return crit(id, { score: 80, coverage: 0.9, evidenceStatus: "sufficient" });
      case "professionalism":
        return crit(id, { score: 90, coverage: 1, evidenceStatus: "sufficient" });
      default:
        return crit(id); // performance / consistency / community / growth = null
    }
  });

  const r = runScoreEngine(criteria);

  // earned = 0.72*20 + 0.65*10 + 0.80*10 + 0.90*5 = 14.4 + 6.5 + 8 + 4.5 = 33.4
  // scoredWeight = 20 + 10 + 10 + 5 = 45 ; 33.4 / 45 * 100 = 74.22 -> 74
  assert.equal(r.score, 74);
  assert.equal(r.tier, "B");
  // coverage = (0.8*20 + 0.6*10 + 0.9*10 + 1*5) / 100 = (16 + 6 + 9 + 5)/100 = 0.36
  assert.equal(r.evidenceCoverage, 0.36);
  assert.equal(r.confidence, "low");
  assert.equal(r.scoredWeight, 45);
  assert.equal(r.insufficientEvidence, false);
  assert.equal(r.subscores.performance.score, null);
  assert.equal(r.subscores.consistency.score, null);
  assert.equal(r.subscores.community_quality.score, null);
  assert.equal(r.subscores.growth_potential.score, null);
});

test("80/82) the prompt forbids turning observed metrics into a grade", () => {
  assert.match(SYSTEM_PROMPT, /M[ÉE]TRICAS OBSERVADAS/);
  assert.match(SYSTEM_PROMPT, /N[ÃA]O transforme m[ée]trica em nota/i);
  assert.match(SYSTEM_PROMPT, /N[ÃA]O afirme fraude/i);
});
