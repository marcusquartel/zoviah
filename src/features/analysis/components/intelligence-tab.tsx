"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalysisResult } from "@/features/analysis/components/analysis-result";
import { AnalysisHistory } from "@/features/analysis/components/analysis-history";
import { AnalyzeButton } from "@/features/analysis/components/analyze-button";
import type { DrawerAnalysis } from "@/features/creators/data-actions";
import type { ApplicationAnalysisStatus } from "@/types/database";

export function IntelligenceTab({
  applicationId,
  analysisStatus,
  analysis,
  onRefresh,
}: {
  applicationId: string;
  analysisStatus: ApplicationAnalysisStatus;
  analysis: DrawerAnalysis;
  onRefresh: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);

  if (!analysis.aiConfigured) {
    return (
      <div className="rounded-lg border border-dashed bg-surface p-6 text-center text-sm text-muted-foreground">
        IA não configurada.
      </div>
    );
  }

  if (analysisStatus === "processing") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">Analisando…</p>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  if (showHistory) {
    return (
      <AnalysisHistory
        history={analysis.history}
        onBack={() => setShowHistory(false)}
      />
    );
  }

  const current = analysis.current;

  if (!current) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">
          Esta creator ainda não foi analisada.
        </p>
        <AnalyzeButton applicationId={applicationId} onDone={onRefresh} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {analysisStatus === "failed" ? (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">
          A última tentativa de análise falhou. Mostrando a análise concluída
          anterior.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <AnalyzeButton
          applicationId={applicationId}
          label="Reanalisar"
          variant="outline"
          onDone={onRefresh}
        />
        {analysis.history.length > 1 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(true)}
          >
            <History className="size-4" /> Histórico ({analysis.history.length})
          </Button>
        ) : null}
      </div>

      <AnalysisResult analysis={current} />
    </div>
  );
}
