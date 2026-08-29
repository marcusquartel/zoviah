/**
 * Creator Score — canonical model. SINGLE SOURCE OF TRUTH for weights and
 * versions. No magic numbers anywhere else.
 *
 * 8 criteria, 100 points. 60 are deterministic (computed from structured data
 * in `objective.ts`), 40 are qualitative (assessed by the model in
 * `prompt.ts` / the qualitative schema). The deterministic score engine
 * (`score-engine.ts`) combines them — the model never returns a total.
 */

// SCORING_VERSION is NOT changed by Phase 3B — the deterministic engine and
// weights are identical to Phase 3A. Only the PROMPT changed (it now
// acknowledges observed metrics), so PROMPT_VERSION advances to v2. Old
// analyses keep their stored "creator-analysis-v1" — nothing is reprocessed.
export const SCORING_VERSION = "creator-score-v1";
export const PROMPT_VERSION = "creator-analysis-v2";

export type CriterionSource = "deterministic" | "ai";

export type CriterionId =
  | "performance"
  | "content_quality"
  | "consistency"
  | "communication"
  | "brand_affinity"
  | "community_quality"
  | "growth_potential"
  | "professionalism";

interface CriterionDef {
  id: CriterionId;
  weight: number;
  source: CriterionSource;
  label: string;
}

export const CRITERIA: Record<CriterionId, CriterionDef> = {
  performance: {
    id: "performance",
    weight: 25,
    source: "deterministic",
    label: "Performance",
  },
  content_quality: {
    id: "content_quality",
    weight: 20,
    source: "ai",
    label: "Qualidade de conteúdo",
  },
  consistency: {
    id: "consistency",
    weight: 15,
    source: "deterministic",
    label: "Consistência",
  },
  communication: {
    id: "communication",
    weight: 10,
    source: "ai",
    label: "Comunicação",
  },
  brand_affinity: {
    id: "brand_affinity",
    weight: 10,
    source: "ai",
    label: "Afinidade",
  },
  community_quality: {
    id: "community_quality",
    weight: 10,
    source: "deterministic",
    label: "Comunidade",
  },
  growth_potential: {
    id: "growth_potential",
    weight: 5,
    source: "deterministic",
    label: "Crescimento",
  },
  professionalism: {
    id: "professionalism",
    weight: 5,
    source: "deterministic",
    label: "Profissionalismo",
  },
};

export const CRITERION_IDS = Object.keys(CRITERIA) as CriterionId[];

export const AI_CRITERION_IDS = CRITERION_IDS.filter(
  (id) => CRITERIA[id].source === "ai",
);
export const DETERMINISTIC_CRITERION_IDS = CRITERION_IDS.filter(
  (id) => CRITERIA[id].source === "deterministic",
);

export const TOTAL_WEIGHT = CRITERION_IDS.reduce(
  (sum, id) => sum + CRITERIA[id].weight,
  0,
);

/** Below this much scored weight there is no preliminary score at all (§8). */
export const MIN_SCORED_WEIGHT = 10;

export const EVIDENCE_STATUSES = [
  "insufficient",
  "partial",
  "sufficient",
] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

/** One criterion's assessment, from either layer. */
export interface CriterionResult {
  id: CriterionId;
  weight: number;
  source: CriterionSource;
  /** 0..100, or null when there is not enough evidence. Never 0 for "unknown". */
  score: number | null;
  /** 0..1 — how much of what this criterion needs was actually available. */
  coverage: number;
  evidenceStatus: EvidenceStatus;
  rationale: string;
  evidenceUsed: string[];
}
