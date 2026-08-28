import type {
  AnalysisConfidence,
  AnalysisTier,
  ApplicationAnalysisStatus,
} from "@/types/database";

/**
 * Product-neutral label for the score. The SaaS core says "Creator Score";
 * a tenant could later override this from `organization_settings` — that is the
 * single extension point (§90), no hard-coded "Rare" anywhere else.
 */
export const SCORE_LABEL = "Creator Score";
export const SCORE_MAX = 100;

export const TIER_LABELS: Record<AnalysisTier, string> = {
  A: "A — Prioridade alta",
  B: "B — Boa",
  C: "C — Média",
  D: "D — Baixa prioridade",
};

export const TIER_SHORT: Record<AnalysisTier, string> = {
  A: "A",
  B: "B",
  C: "C",
  D: "D",
};

export const CONFIDENCE_LABELS: Record<AnalysisConfidence, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
};

export const ANALYSIS_STATUS_LABELS: Record<ApplicationAnalysisStatus, string> =
  {
    not_analyzed: "Não analisada",
    processing: "Analisando…",
    completed: "Concluída",
    failed: "Falhou",
  };

export function coveragePct(coverage: number | null): string {
  if (coverage == null) return "—";
  return `${Math.round(coverage * 100)}%`;
}
