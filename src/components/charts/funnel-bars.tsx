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
    <div className={cn("space-y-1.5", className)}>
      {stages.map((s, i) => {
        const pct = Math.max((s.count / max) * 100, s.count > 0 ? 4 : 1.5);
        const prev = i > 0 ? stages[i - 1].count : null;
        const conv =
          prev && prev > 0 ? Math.round((s.count / prev) * 100) : null;
        return (
          <div key={s.label}>
            {conv != null ? (
              <p className="pl-1 text-[0.6875rem] tabular-nums text-muted-foreground/70">
                ↳ {conv}%
              </p>
            ) : null}
            <div className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs text-muted-foreground">
                {s.label}
              </span>
              <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted">
                <div
                  className="flex h-full items-center rounded-md bg-chart-1/85 px-2"
                  style={{ width: `${pct}%` }}
                >
                  <span className="text-[0.6875rem] font-medium tabular-nums text-primary-foreground">
                    {s.count}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
