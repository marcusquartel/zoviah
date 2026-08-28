/**
 * Glue between the layers. PURE (no I/O). Takes the deterministic criteria and
 * the model's qualitative output, builds the full 8-criterion list (objective
 * results are authoritative for their 5; the model cannot override them, §44),
 * runs the deterministic score engine, and shapes the row for
 * `complete_creator_analysis`.
 */
import {
  AI_CRITERION_IDS,
  CRITERIA,
  SCORING_VERSION,
  type CriterionId,
  type CriterionResult,
} from "./criteria.ts";
import { runScoreEngine } from "./score-engine.ts";
import type { QualitativeOutput } from "./qualitative-schema.ts";
import type { ClaudePayload } from "./sanitize.ts";

export { SCORING_VERSION };

function qualitativeToCriteria(q: QualitativeOutput): CriterionResult[] {
  return AI_CRITERION_IDS.map((id) => {
    const c = q.criteria[id as "content_quality" | "communication" | "brand_affinity"];
    return {
      id,
      weight: CRITERIA[id].weight,
      source: "ai" as const,
      score: c.score,
      coverage: c.coverage,
      evidenceStatus: c.evidence_status,
      rationale: c.rationale,
      evidenceUsed: c.evidence_used,
    };
  });
}

export interface CombinedAnalysis {
  scoringVersion: string;
  score: number | null;
  tier: "A" | "B" | "C" | "D" | null;
  confidence: "low" | "medium" | "high";
  evidenceCoverage: number;
  scoredWeight: number;
  insufficientEvidence: boolean;
  subscores: Record<CriterionId, unknown>;
  criteria: CriterionResult[];
  summary: string;
  strengths: string[];
  attentionPoints: string[];
  suggestedTags: string[];
}

export function combineAnalysis(
  objective: CriterionResult[],
  qualitative: QualitativeOutput,
): CombinedAnalysis {
  const criteria = [...objective, ...qualitativeToCriteria(qualitative)];
  const engine = runScoreEngine(criteria);

  // Add a standard attention point when big deterministic criteria are unknown.
  const attentionPoints = [...qualitative.attention_points];
  if (
    objective.find((c) => c.id === "performance")?.score === null &&
    attentionPoints.length < 5
  ) {
    attentionPoints.push(
      "Dados de performance ainda não verificados (sem métricas de engajamento).",
    );
  }

  return {
    scoringVersion: SCORING_VERSION,
    score: engine.score,
    tier: engine.tier,
    confidence: engine.confidence,
    evidenceCoverage: engine.evidenceCoverage,
    scoredWeight: engine.scoredWeight,
    insufficientEvidence: engine.insufficientEvidence,
    subscores: engine.subscores,
    criteria,
    summary: qualitative.summary,
    strengths: qualitative.strengths.slice(0, 5),
    attentionPoints: attentionPoints.slice(0, 5),
    suggestedTags: qualitative.suggested_tags.slice(0, 8),
  };
}

/** The jsonb passed to `complete_creator_analysis`. */
export function toCompletionResult(
  combined: CombinedAnalysis,
  meta: {
    model: string;
    inputTokens: number | null;
    outputTokens: number | null;
    latencyMs: number;
    inputSnapshot: ClaudePayload;
    rawResult: QualitativeOutput;
  },
): Record<string, unknown> {
  return {
    model: meta.model,
    score: combined.score,
    tier: combined.tier,
    confidence: combined.confidence,
    evidence_coverage: combined.evidenceCoverage,
    subscores: combined.subscores,
    summary: combined.summary,
    strengths: combined.strengths,
    attention_points: combined.attentionPoints,
    suggested_tags: combined.suggestedTags,
    input_snapshot: meta.inputSnapshot,
    raw_result: meta.rawResult,
    input_tokens: meta.inputTokens,
    output_tokens: meta.outputTokens,
    latency_ms: meta.latencyMs,
  };
}
