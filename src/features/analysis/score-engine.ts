/**
 * Deterministic score engine. PURE — no DB, no Claude, no I/O.
 *
 * It receives the 8 CriterionResults (deterministic + qualitative already
 * combined) and produces the preliminary score, evidence coverage, confidence
 * and tier. The model never contributes a number here.
 *
 * Formulas (§5–§9):
 *   scoredWeight   = Σ weight of criteria whose score is not null
 *   earnedPoints   = Σ (score/100 · weight) over those same criteria
 *   score          = round(earnedPoints / scoredWeight · 100)   [null if scoredWeight < MIN_SCORED_WEIGHT]
 *   coverage       = Σ (weight · coverage) over ALL 8 criteria / 100      → 0..1
 *   confidence     = coverage <0.45 → low · <0.75 → medium · else high
 *   tier           = 85–100 A · 70–84 B · 55–69 C · 0–54 D               [null if score null]
 */
import {
  CRITERION_IDS,
  MIN_SCORED_WEIGHT,
  TOTAL_WEIGHT,
  type CriterionId,
  type CriterionResult,
  type CriterionSource,
  type EvidenceStatus,
} from "./criteria.ts";
import type { AnalysisConfidence, AnalysisTier } from "@/types/database";

export interface Subscore {
  score: number | null;
  weight: number;
  coverage: number;
  source: CriterionSource;
  evidenceStatus: EvidenceStatus;
}

export interface ScoreResult {
  score: number | null;
  tier: AnalysisTier | null;
  confidence: AnalysisConfidence;
  evidenceCoverage: number; // 0..1, rounded to 3 decimals
  scoredWeight: number;
  earnedPoints: number;
  insufficientEvidence: boolean;
  subscores: Record<CriterionId, Subscore>;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function tierFromScore(score: number): AnalysisTier {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}

function confidenceFromCoverage(coverage: number): AnalysisConfidence {
  if (coverage < 0.45) return "low";
  if (coverage < 0.75) return "medium";
  return "high";
}

export function runScoreEngine(criteria: CriterionResult[]): ScoreResult {
  const byId = new Map(criteria.map((c) => [c.id, c]));

  const subscores = {} as Record<CriterionId, Subscore>;
  let scoredWeight = 0;
  let earnedPoints = 0;
  let coveragePoints = 0;

  for (const id of CRITERION_IDS) {
    const c = byId.get(id);
    const weight = c?.weight ?? 0;
    const coverage = c ? clamp(c.coverage, 0, 1) : 0;
    const score =
      c && c.score !== null ? clamp(c.score, 0, 100) : null;

    subscores[id] = {
      score,
      weight,
      coverage,
      source: c?.source ?? "deterministic",
      evidenceStatus: c?.evidenceStatus ?? "insufficient",
    };

    coveragePoints += weight * coverage;
    if (score !== null) {
      scoredWeight += weight;
      earnedPoints += (score / 100) * weight;
    }
  }

  const evidenceCoverage =
    Math.round((coveragePoints / TOTAL_WEIGHT) * 1000) / 1000;
  const confidence = confidenceFromCoverage(evidenceCoverage);

  const insufficientEvidence = scoredWeight < MIN_SCORED_WEIGHT;
  const score = insufficientEvidence
    ? null
    : Math.round((earnedPoints / scoredWeight) * 100);
  const tier = score === null ? null : tierFromScore(score);

  return {
    score,
    tier,
    confidence,
    evidenceCoverage,
    scoredWeight,
    earnedPoints: Math.round(earnedPoints * 100) / 100,
    insufficientEvidence,
    subscores,
  };
}
