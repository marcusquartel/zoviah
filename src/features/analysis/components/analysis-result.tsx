"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  CRITERIA,
  CRITERION_IDS,
  type CriterionId,
} from "@/features/analysis/criteria";
import {
  CONFIDENCE_LABELS,
  SCORE_LABEL,
  SCORE_MAX,
  TIER_LABELS,
  coveragePct,
} from "@/features/analysis/labels";
import type { CreatorAnalysis } from "@/types/database";

interface Subscore {
  score: number | null;
  weight: number;
  coverage: number;
  source: string;
  evidence_status?: string;
  evidenceStatus?: string;
}

interface RawCriterion {
  score?: number | null;
  coverage?: number;
  rationale?: string;
}

export function AnalysisResult({ analysis }: { analysis: CreatorAnalysis }) {
  const subscores = (analysis.subscores ?? {}) as unknown as Record<
    string,
    Subscore
  >;
  const rawCriteria =
    ((analysis.raw_result as unknown as Record<string, unknown> | null)
      ?.criteria as Record<string, RawCriterion> | undefined) ?? {};

  const lowConfidence = analysis.confidence === "low";

  return (
    <div className="space-y-5">
      {/* headline */}
      <div className="rounded-xl border bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {SCORE_LABEL}
        </p>
        {analysis.score == null ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Dados insuficientes para score.
          </p>
        ) : (
          <div className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="text-3xl font-semibold tabular-nums">
              {analysis.score}
              <span className="text-base text-muted-foreground">
                {" "}
                / {SCORE_MAX}
              </span>
            </span>
            {analysis.tier ? (
              <span className="text-sm font-medium">
                {TIER_LABELS[analysis.tier]}
              </span>
            ) : null}
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Confidence:{" "}
            <strong className="text-foreground">
              {analysis.confidence
                ? CONFIDENCE_LABELS[analysis.confidence]
                : "—"}
            </strong>
          </span>
          <span>
            Evidence coverage:{" "}
            <strong className="text-foreground">
              {coveragePct(analysis.evidence_coverage)}
            </strong>
          </span>
        </div>
        {lowConfidence ? (
          <p className="mt-2 flex items-start gap-1.5 rounded-md bg-warning/10 p-2 text-xs text-warning-foreground">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            Score preliminar baseado em evidência limitada.
          </p>
        ) : null}
      </div>

      {/* breakdown */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Critérios
        </p>
        {CRITERION_IDS.map((id) => (
          <CriterionRow
            key={id}
            id={id}
            sub={subscores[id]}
            rationale={rawCriteria[id]?.rationale}
          />
        ))}
        <p className="pt-1 text-[0.7rem] text-muted-foreground">
          60% estrutura objetiva · 40% avaliação qualitativa · critérios sem
          evidência não recebem nota.
        </p>
      </div>

      {analysis.summary ? (
        <Section title="Resumo">
          <p className="text-sm text-muted-foreground">{analysis.summary}</p>
        </Section>
      ) : null}

      {analysis.strengths && analysis.strengths.length > 0 ? (
        <Section title="Pontos fortes">
          <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            {analysis.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {analysis.attention_points && analysis.attention_points.length > 0 ? (
        <Section title="Pontos de atenção">
          <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
            {analysis.attention_points.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      {analysis.suggested_tags && analysis.suggested_tags.length > 0 ? (
        <Section title="Tags sugeridas">
          <div className="flex flex-wrap gap-1.5">
            {analysis.suggested_tags.map((t) => (
              <Badge key={t} variant="secondary">
                {t}
              </Badge>
            ))}
          </div>
          <p className="mt-1 text-[0.7rem] text-muted-foreground">
            Sugestões — não aplicadas ao cadastro.
          </p>
        </Section>
      ) : null}

      <p className="text-[0.7rem] text-muted-foreground">
        {analysis.model ?? "modelo?"} · prompt {analysis.prompt_version} ·
        scoring {analysis.scoring_version}
        {analysis.input_tokens != null
          ? ` · ${analysis.input_tokens}+${analysis.output_tokens ?? 0} tokens`
          : ""}
        {analysis.latency_ms != null
          ? ` · ${(analysis.latency_ms / 1000).toFixed(1)}s`
          : ""}
      </p>
    </div>
  );
}

function CriterionRow({
  id,
  sub,
  rationale,
}: {
  id: CriterionId;
  sub: Subscore | undefined;
  rationale?: string;
}) {
  const [open, setOpen] = useState(false);
  const def = CRITERIA[id];
  const score = sub?.score ?? null;
  const hasRationale = Boolean(rationale && rationale.trim());

  return (
    <div className="rounded-md border px-3 py-2">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span>{def.label}</span>
        <span className="flex items-center gap-2 tabular-nums">
          {score == null ? (
            <span className="text-xs text-muted-foreground">
              — / {def.weight} · dados insuficientes
            </span>
          ) : (
            <span className="font-medium">
              {((score / 100) * def.weight).toFixed(1)}
              <span className="text-muted-foreground"> / {def.weight}</span>
            </span>
          )}
          {hasRationale ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="Ver justificativa"
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronDown
                className={cn("size-4 transition-transform", open && "rotate-180")}
              />
            </button>
          ) : null}
        </span>
      </div>
      {open && hasRationale ? (
        <p className="mt-1.5 text-xs text-muted-foreground">{rationale}</p>
      ) : null}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}
