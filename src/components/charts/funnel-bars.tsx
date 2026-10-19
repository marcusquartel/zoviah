import { cn } from "@/lib/utils";

export interface FunnelStage {
  label: string;
  count: number;
}

/**
 * Application funnel as a set of stepped bars. Each bar's width is relative to
 * the largest stage; the conversion to the next stage is shown between rows.
 * Dependency-free.
 */
export function FunnelBars({
  stages,
  className,
}: {
  stages: FunnelStage[];
  className?: string;
}) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  const anyData = stages.some((s) => s.count > 0);

  if (!anyData) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        O funil aparece quando houver inscrições.
      </p>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {stages.map((s, i) => {
        const pct = Math.max((s.count / max) * 100, s.count > 0 ? 14 : 0);
        const prev = i > 0 ? stages[i - 1].count : null;
        const conv =
          prev && prev > 0 ? Math.round((s.count / prev) * 100) : null;
        return (
          <div key={s.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span>{s.label}</span>
              <span className="text-[0.8125rem] tabular-nums text-faint">
                {conv != null ? `${conv}% da etapa anterior` : ""}
              </span>
            </div>
            <div className="h-9 overflow-hidden rounded-full bg-muted">
              {s.count > 0 ? (
                <div
                  className="flex h-full items-center justify-end rounded-full bg-ink pr-3.5"
                  style={{ width: `${pct}%` }}
                >
                  <span className="text-sm tabular-nums text-ink-foreground">
                    {s.count}
                  </span>
                </div>
              ) : (
                <div className="flex h-full items-center pl-3.5 text-sm tabular-nums text-faint">
                  0
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
