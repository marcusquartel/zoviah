"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnalyzeButton } from "@/features/analysis/components/analyze-button";
import {
  CONFIDENCE_LABELS,
  SCORE_LABEL,
  SCORE_MAX,
  TIER_SHORT,
  coveragePct,
} from "@/features/analysis/labels";
import type {
  ApplicationAnalysisStatus,
  CreatorAnalysis,
} from "@/types/database";

const TIER_STYLES: Record<string, string> = {
  A: "bg-success/15 text-success",
  B: "bg-primary/10 text-primary",
  C: "bg-warning/15 text-warning-foreground",
  D: "bg-muted text-muted-foreground",
};

/**
 * Always-visible score strip pinned to the top of the creator modal — shows
 * the current score on every tab, plus the analyse / re-analyse action.
 */
export function ScoreBar({
  applicationId,
  analysisStatus,
  current,
  aiConfigured,
  onRefresh,
}: {
  applicationId: string;
  analysisStatus: ApplicationAnalysisStatus;
  current: CreatorAnalysis | null;
  aiConfigured: boolean;
  onRefresh: () => void;
}) {
  const lowConfidence = current?.confidence === "low";

  return (
    <div className="flex items-center justify-between gap-3 border-b bg-surface px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {SCORE_LABEL}
        </span>

        {analysisStatus === "processing" ? (
          <span className="text-sm text-muted-foreground">Analisando…</span>
        ) : current && current.score != null ? (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-xl font-semibold tabular-nums">
              {current.score}
              <span className="text-sm text-muted-foreground">
                {" "}
                / {SCORE_MAX}
              </span>
            </span>
            {current.tier ? (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-xs font-medium",
                  TIER_STYLES[current.tier] ?? "bg-muted",
                )}
              >
                {TIER_SHORT[current.tier]}
              </span>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {current.confidence
                ? CONFIDENCE_LABELS[current.confidence]
                : "—"}{" "}
              · cov {coveragePct(current.evidence_coverage)}
            </span>
            {lowConfidence ? (
              <span className="inline-flex items-center gap-1 text-xs text-warning-foreground">
                <AlertTriangle className="size-3" /> preliminar
              </span>
            ) : null}
          </div>
        ) : current ? (
          <span className="text-sm text-muted-foreground">
            Dados insuficientes para score
          </span>
        ) : analysisStatus === "failed" ? (
          <span className="text-sm text-danger">Última análise falhou</span>
        ) : (
          <span className="text-sm text-muted-foreground">Sem análise</span>
        )}
      </div>

      {aiConfigured && analysisStatus !== "processing" ? (
        <AnalyzeButton
          applicationId={applicationId}
          label={current ? "Reanalisar" : "Analisar creator"}
          variant="outline"
          onDone={onRefresh}
        />
      ) : null}
    </div>
  );
}
