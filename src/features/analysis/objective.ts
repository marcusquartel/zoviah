/**
 * Deterministic criteria (§4, §10–§15). PURE.
 *
 * Rule that matters most (§4, §95): missing evidence => score = null (UNKNOWN),
 * never 0 (BAD). In this phase almost every deterministic criterion lacks the
 * data it needs, so most return null. Only `professionalism` gets a real
 * score, from non-discriminatory operational signals.
 */
import { CRITERIA, type CriterionResult } from "./criteria.ts";
import type { SanitizedEvidence } from "./sanitize.ts";

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * PERFORMANCE (25) — needs real engagement metrics (median/average views,
 * engagement, reach). Followers alone is NOT performance (§10). We do not have
 * any of those yet, so: null. `average_views_declared` exists in the schema but
 * turning `avg_views / followers` into a universal grade requires an explicit,
 * documented threshold rule that this phase deliberately does not ship (§11) —
 * the function shape below is the extension point.
 */
function performance(ev: SanitizedEvidence): CriterionResult {
  const m = ev.declaredMetrics;
  const hasAny =
    m.instagram_avg_views != null || m.tiktok_avg_views != null;
  // Extension point: when real metrics land, compute view_rate etc. here
  // behind a configured, documented rule. For now it stays UNKNOWN.
  return {
    id: "performance",
    weight: CRITERIA.performance.weight,
    source: "deterministic",
    score: null,
    coverage: 0,
    evidenceStatus: "insufficient",
    rationale: hasAny
      ? "Views médias declaradas existem, mas sem regra de performance verificada nesta fase — não geram nota."
      : "Sem métricas de engajamento (views, alcance, interações). Seguidores sozinhos não medem performance.",
    evidenceUsed: [],
  };
}

/** CONSISTENCY (15) — needs post dates / frequency / distribution (§12). None. */
function consistency(): CriterionResult {
  return {
    id: "consistency",
    weight: CRITERIA.consistency.weight,
    source: "deterministic",
    score: null,
    coverage: 0,
    evidenceStatus: "insufficient",
    rationale:
      "Sem histórico de publicações (datas, frequência, distribuição de views).",
    evidenceUsed: [],
  };
}

/** COMMUNITY QUALITY (10) — needs comments / interactions (§13). None. */
function communityQuality(): CriterionResult {
  return {
    id: "community_quality",
    weight: CRITERIA.community_quality.weight,
    source: "deterministic",
    score: null,
    coverage: 0,
    evidenceStatus: "insufficient",
    rationale:
      "Sem dados de comunidade (comentários, interações, comportamento de resposta).",
    evidenceUsed: [],
  };
}

/** GROWTH POTENTIAL (5) — needs historical follower snapshots (§14). None. */
function growthPotential(): CriterionResult {
  return {
    id: "growth_potential",
    weight: CRITERIA.growth_potential.weight,
    source: "deterministic",
    score: null,
    coverage: 0,
    evidenceStatus: "insufficient",
    rationale:
      "Sem snapshots históricos de audiência para avaliar tendência de crescimento.",
    evidenceUsed: [],
  };
}

/**
 * PROFESSIONALISM (5) — non-discriminatory operational signals only (§15):
 * cadastro suficientemente preenchido, links válidos quando fornecidos, redes
 * fornecidas corretamente. NUNCA penaliza por: nunca ter trabalhado com marcas,
 * não ter mídia kit, ter poucos seguidores, ser iniciante.
 */
function professionalism(ev: SanitizedEvidence): CriterionResult {
  const reg = ev.registration;
  const identityParts = [
    reg.hasName,
    reg.hasEmail || reg.hasPhone,
    reg.hasCity || reg.hasState,
  ];
  const completeness =
    identityParts.filter(Boolean).length / identityParts.length;

  const socialsOk =
    ev.socialHandles.length > 0
      ? ev.socialHandles.filter((s) => s.plausible).length /
        ev.socialHandles.length
      : 0;

  const links = ev.contentLinks;
  const linksValidity =
    links.length > 0
      ? links.filter(isHttpUrl).length / links.length
      : null;

  const parts = [completeness, socialsOk];
  const evidenceUsed = ["cadastro", "redes informadas"];
  if (linksValidity !== null) {
    parts.push(linksValidity);
    evidenceUsed.push("links de conteúdo");
  }

  const score = Math.round(
    (parts.reduce((a, b) => a + b, 0) / parts.length) * 100,
  );
  const coverage = linksValidity !== null ? 1 : 0.7;

  return {
    id: "professionalism",
    weight: CRITERIA.professionalism.weight,
    source: "deterministic",
    score,
    coverage,
    evidenceStatus: coverage >= 0.8 ? "sufficient" : "partial",
    rationale:
      `Cadastro ${Math.round(completeness * 100)}% preenchido; ` +
      `${ev.socialHandles.length} rede(s) informada(s)` +
      (linksValidity !== null
        ? `; ${Math.round(linksValidity * 100)}% dos links válidos.`
        : "."),
    evidenceUsed,
  };
}

/** The 5 deterministic CriterionResults for an application. */
export function computeObjectiveCriteria(
  ev: SanitizedEvidence,
): CriterionResult[] {
  return [
    performance(ev),
    consistency(),
    communityQuality(),
    growthPotential(),
    professionalism(ev),
  ];
}
