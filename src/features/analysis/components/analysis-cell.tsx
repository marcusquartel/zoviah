import { cn } from "@/lib/utils";
import { CONFIDENCE_LABELS, TIER_SHORT } from "@/features/analysis/labels";
import type { ApplicationListItem } from "@/types/database";

const TIER_STYLES: Record<string, string> = {
  A: "bg-success/15 text-success",
  B: "bg-primary/10 text-primary",
  C: "bg-warning/15 text-warning-foreground",
  D: "bg-muted text-muted-foreground",
};

/** Compact score / tier / confidence for the CRM list and Kanban card (§50). */
export function AnalysisCell({
  item,
  compact = false,
}: {
  item: Pick<
    ApplicationListItem,
    "analysis_status" | "current_score" | "current_tier" | "analysis_confidence"
  >;
  compact?: boolean;
}) {
  if (item.analysis_status === "processing") {
    return <span className="text-xs text-muted-foreground">Analisando…</span>;
  }
  if (item.analysis_status === "failed" && item.current_score == null) {
    return <span className="text-xs text-danger">Falhou</span>;
  }
  if (item.current_score == null || item.current_tier == null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="font-semibold tabular-nums">{item.current_score}</span>
      <span
        className={cn(
          "rounded px-1 font-medium",
          TIER_STYLES[item.current_tier] ?? "bg-muted",
        )}
      >
        {TIER_SHORT[item.current_tier]}
      </span>
      {!compact && item.analysis_confidence ? (
        <span className="text-muted-foreground">
          {CONFIDENCE_LABELS[item.analysis_confidence]}
        </span>
      ) : null}
    </div>
  );
}
