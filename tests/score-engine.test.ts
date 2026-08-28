import { test } from "node:test";
import assert from "node:assert/strict";
import { runScoreEngine } from "../src/features/analysis/score-engine.ts";
import {
  CRITERIA,
  CRITERION_IDS,
  MIN_SCORED_WEIGHT,
  TOTAL_WEIGHT,
  type CriterionId,
  type CriterionResult,
} from "../src/features/analysis/criteria.ts";

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

/** all 8 criteria, all null unless overridden */
function allCriteria(
  overrides: Partial<Record<CriterionId, Partial<CriterionResult>>> = {},
): CriterionResult[] {
  return CRITERION_IDS.map((id) => crit(id, overrides[id] ?? {}));
}

test("12) weights sum to exactly 100", () => {
  assert.equal(TOTAL_WEIGHT, 100);
  assert.equal(
    CRITERION_IDS.reduce((s, id) => s + CRITERIA[id].weight, 0),
    100,
  );
});

test("1) all 8 criteria scored -> exact weighted score, tier, high confidence", () => {
  // every criterion 80/100, coverage 1  =>  score 80, coverage 100%
  const r = runScoreEngine(
    allCriteria(
      Object.fromEntries(
        CRITERION_IDS.map((id) => [
          id,
          { score: 80, coverage: 1, evidenceStatus: "sufficient" as const },
        ]),
      ),
    ),
  );
  assert.equal(r.score, 80);
  assert.equal(r.tier, "B");
  assert.equal(r.evidenceCoverage, 1);
  assert.equal(r.confidence, "high");
  assert.equal(r.scoredWeight, 100);
});

test("2) only some criteria scored -> spec example gives 73", () => {
  // brand_affinity 80/100 w10 ; professionalism 60/100 w5 ; rest null
  const r = runScoreEngine(
    allCriteria({
      brand_affinity: { score: 80, coverage: 1 },
      professionalism: { score: 60, coverage: 1 },
    }),
  );
  // earned = 8 + 3 = 11 ; scoredWeight = 15 ; 11/15*100 = 73.33 -> 73
  assert.equal(r.score, 73);
  // coverage = (10*1 + 5*1) / 100 = 0.15
  assert.equal(r.evidenceCoverage, 0.15);
  assert.equal(r.confidence, "low");
  assert.equal(r.tier, "B");
});

test("3) null score is UNKNOWN, never counted as 0", () => {
  const withNulls = runScoreEngine(
    allCriteria({ brand_affinity: { score: 90, coverage: 1 } }),
  );
  // only brand_affinity counts: 90. If nulls were 0 this would crater.
  assert.equal(withNulls.score, 90);
  assert.equal(withNulls.scoredWeight, 10);
});

test("4) evidence coverage = Σ(weight·coverage)/100 over ALL criteria", () => {
  const r = runScoreEngine(
    allCriteria({
      performance: { coverage: 0.5 }, // 25 * 0.5 = 12.5
      professionalism: { score: 50, coverage: 1 }, // 5 * 1 = 5
      brand_affinity: { score: 50, coverage: 0.2 }, // 10 * 0.2 = 2
    }),
  );
  // (12.5 + 5 + 2) / 100 = 0.195
  assert.equal(r.evidenceCoverage, 0.195);
});

test("5) confidence thresholds: low <45%, medium 45-74%, high >=75%", () => {
  // Every criterion at coverage X => total coverage = Σ(weight·X)/100 = X.
  const at = (cov: number) =>
    runScoreEngine(
      CRITERION_IDS.map((id) => crit(id, { coverage: cov })),
    ).confidence;
  assert.equal(at(0.2), "low");
  assert.equal(at(0.44), "low");
  assert.equal(at(0.45), "medium");
  assert.equal(at(0.6), "medium");
  assert.equal(at(0.74), "medium");
  assert.equal(at(0.75), "high");
  assert.equal(at(0.95), "high");
});

test("6-9) tiers A/B/C/D from score", () => {
  const scoreTo = (s: number) =>
    runScoreEngine(
      allCriteria({ performance: { score: s, coverage: 1 } }),
    ).tier;
  assert.equal(scoreTo(90), "A");
  assert.equal(scoreTo(85), "A");
  assert.equal(scoreTo(84), "B");
  assert.equal(scoreTo(70), "B");
  assert.equal(scoreTo(69), "C");
  assert.equal(scoreTo(55), "C");
  assert.equal(scoreTo(54), "D");
  assert.equal(scoreTo(0), "D");
});

test("10) no criterion scored -> score and tier null, confidence still reported", () => {
  const r = runScoreEngine(allCriteria());
  assert.equal(r.score, null);
  assert.equal(r.tier, null);
  assert.equal(r.confidence, "low");
  assert.equal(r.evidenceCoverage, 0);
  assert.equal(r.insufficientEvidence, true);
});

test("11) below the minimum scored weight there is no preliminary score", () => {
  assert.equal(MIN_SCORED_WEIGHT, 10);
  // growth_potential alone = weight 5 < 10 -> null
  const under = runScoreEngine(
    allCriteria({ growth_potential: { score: 100, coverage: 1 } }),
  );
  assert.equal(under.score, null);
  assert.equal(under.tier, null);
  assert.equal(under.insufficientEvidence, true);

  // brand_affinity alone = weight 10 -> a score exists
  const at = runScoreEngine(
    allCriteria({ brand_affinity: { score: 100, coverage: 1 } }),
  );
  assert.equal(at.score, 100);
  assert.equal(at.tier, "A");
  assert.equal(at.insufficientEvidence, false);
});

test("subscores snapshot has all 8 criteria with source + weight", () => {
  const r = runScoreEngine(allCriteria({ brand_affinity: { score: 70, coverage: 1 } }));
  assert.equal(Object.keys(r.subscores).length, 8);
  assert.equal(r.subscores.performance.source, "deterministic");
  assert.equal(r.subscores.brand_affinity.source, "ai");
  assert.equal(r.subscores.performance.weight, 25);
  assert.equal(r.subscores.brand_affinity.score, 70);
  assert.equal(r.subscores.performance.score, null);
});

test("out-of-range inputs are clamped, not trusted", () => {
  const r = runScoreEngine(
    allCriteria({
      brand_affinity: { score: 250, coverage: 5 },
      professionalism: { score: -30, coverage: -1 },
    }),
  );
  // brand_affinity clamped to 100 (w10 -> 10) ; professionalism clamped to 0 (w5 -> 0)
  // scoredWeight 15 ; earned 10 ; 10/15*100 = 66.67 -> 67
  assert.equal(r.score, 67);
  assert.ok(r.evidenceCoverage <= 1 && r.evidenceCoverage >= 0);
});
