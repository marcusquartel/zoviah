"use client";

import { useState, useTransition } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalysisResult } from "@/features/analysis/components/analysis-result";
import { loadAnalysisSnapshot } from "@/features/creators/data-actions";
import { CONFIDENCE_LABELS, coveragePct } from "@/features/analysis/labels";
import { formatDateTime } from "@/features/creators/format";
import type { CreatorAnalysis } from "@/types/database";
import type { AnalysisHistoryItem } from "@/features/analysis/queries";

const STATUS_TAG: Record<string, string> = {
  completed: "",
  failed: "· falhou",
  processing: "· processando",
};

export function AnalysisHistory({
  history,
  onBack,
}: {
  history: AnalysisHistoryItem[];
  onBack: () => void;
}) {
  const [snapshot, setSnapshot] = useState<CreatorAnalysis | null>(null);
  const [loading, startLoad] = useTransition();

  if (snapshot) {
    return (
      <div className="space-y-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSnapshot(null)}
        >
          <ArrowLeft className="size-4" /> Voltar ao histórico
        </Button>
        <AnalysisResult analysis={snapshot} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="size-4" /> Análise atual
      </Button>

      {loading ? <Skeleton className="h-20 w-full" /> : null}

      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma análise ainda.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {history.map((h) => (
            <li key={h.id}>
              <button
                type="button"
                disabled={h.status !== "completed"}
                onClick={() =>
                  startLoad(async () => {
                    setSnapshot(await loadAnalysisSnapshot(h.id));
                  })
                }
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm enabled:hover:bg-muted disabled:opacity-60"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {h.score ?? "—"}
                    {h.tier ? ` · ${h.tier}` : ""}{" "}
                    <span className="font-normal text-muted-foreground">
                      {h.confidence ? CONFIDENCE_LABELS[h.confidence] : ""}{" "}
                      {STATUS_TAG[h.status] ?? ""}
                    </span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {formatDateTime(h.created_at)} · cov{" "}
                    {coveragePct(h.evidence_coverage)} · {h.model ?? "—"} ·{" "}
                    {h.prompt_version} / {h.scoring_version}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
