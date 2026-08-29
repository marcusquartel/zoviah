"use client";

import { Check, Minus } from "lucide-react";
import { CRITERIA, CRITERION_IDS } from "@/features/analysis/criteria";
import type { CreatorAnalysis } from "@/types/database";

interface Subscore {
  score: number | null;
}

/** Why a still-null deterministic criterion has no score (§42, §68). */
const DETERMINISTIC_GAP_REASON: Record<string, string> = {
  performance:
    "Depende de métricas observadas (views, alcance). Colete um snapshot na aba Métricas.",
  consistency:
    "Depende de frequência de publicação observada (posts por período).",
  community_quality:
    "Depende de sinais de qualidade de audiência ainda não coletados.",
  growth_potential:
    "Depende de dois snapshots do mesmo perfil para medir crescimento.",
  professionalism: "Sem dados de cadastro / redes suficientes.",
};

function readPayload(analysis: CreatorAnalysis) {
  const p = (analysis.input_snapshot ?? {}) as Record<string, unknown>;
  const creator = (p.creator_evidence ?? {}) as Record<string, unknown>;
  const objective = (p.objective_metrics ?? {}) as Record<string, unknown>;
  const declared = (creator.declared_metrics ?? {}) as Record<string, unknown>;
  const answers = (creator.relevant_answers ?? {}) as Record<string, unknown>;
  const topics = (creator.content_topics ?? []) as unknown[];

  return {
    hasTopics: topics.length > 0,
    hasLinks: Number(objective.content_links_provided ?? 0) > 0,
    hasSocials: Number(objective.social_profiles_count ?? 0) > 0,
    hasDeclared: Object.values(declared).some((v) => v != null),
    hasObserved:
      objective.social != null &&
      Object.keys(objective.social as Record<string, unknown>).length > 0,
    hasAnswers: Object.keys(answers).length > 0,
  };
}

export function EvidencePanel({ analysis }: { analysis: CreatorAnalysis }) {
  const ev = readPayload(analysis);
  const subscores = (analysis.subscores ?? {}) as unknown as Record<
    string,
    Subscore
  >;
  const rawCriteria =
    ((analysis.raw_result as unknown as Record<string, unknown> | null)
      ?.criteria as Record<string, { rationale?: string }> | undefined) ?? {};

  const checklist: { label: string; present: boolean }[] = [
    { label: "Redes sociais cadastradas", present: ev.hasSocials },
    { label: "Tópicos de conteúdo", present: ev.hasTopics },
    { label: "Links de conteúdo", present: ev.hasLinks },
    { label: "Respostas do formulário", present: ev.hasAnswers },
    { label: "Métricas declaradas no cadastro", present: ev.hasDeclared },
    { label: "Métricas observadas (snapshot)", present: ev.hasObserved },
  ];

  const gaps = CRITERION_IDS.filter(
    (id) => (subscores[id]?.score ?? null) == null,
  ).map((id) => {
    const def = CRITERIA[id];
    const reason =
      def.source === "ai"
        ? rawCriteria[id]?.rationale?.trim() ||
          "Evidência de conteúdo insuficiente (apenas links, sem amostra)."
        : DETERMINISTIC_GAP_REASON[id] ?? "Dados insuficientes.";
    return { label: def.label, reason };
  });

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Evidências
        </p>
        <ul className="space-y-1 text-sm">
          {checklist.map((c) => (
            <li key={c.label} className="flex items-center gap-2">
              {c.present ? (
                <Check className="size-4 text-success" />
              ) : (
                <Minus className="size-4 text-muted-foreground" />
              )}
              <span
                className={c.present ? undefined : "text-muted-foreground"}
              >
                {c.label}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {gaps.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Dados que ainda faltam
          </p>
          <ul className="space-y-1.5 text-sm">
            {gaps.map((g) => (
              <li key={g.label}>
                <span className="font-medium">{g.label}:</span>{" "}
                <span className="text-muted-foreground">{g.reason}</span>
              </li>
            ))}
          </ul>
          <p className="text-[0.7rem] text-muted-foreground">
            Critérios sem evidência não recebem nota — o score não é penalizado,
            fica &quot;dados insuficientes&quot;.
          </p>
        </div>
      ) : null}
    </div>
  );
}
