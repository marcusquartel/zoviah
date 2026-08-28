"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AnalysisResult } from "@/features/analysis/components/analysis-result";
import { AnalysisHistory } from "@/features/analysis/components/analysis-history";
import type { DrawerAnalysis } from "@/features/creators/data-actions";
import type { ApplicationAnalysisStatus } from "@/types/database";

export function IntelligenceTab({
  analysisStatus,
  analysis,
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
      <p className="rounded-lg border border-dashed bg-surface p-6 text-center text-sm text-muted-foreground">
        Esta creator ainda não foi analisada. Use{" "}
        <strong>Analisar creator</strong> no topo.
      </p>
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

      {analysis.history.length > 1 ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(true)}
          >
            <History className="size-4" /> Histórico ({analysis.history.length})
          </Button>
        </div>
      ) : null}

      <AnalysisResult analysis={current} />
    </div>
  );
}
