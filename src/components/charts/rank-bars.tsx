import Link from "next/link";
import { cn } from "@/lib/utils";

export interface RankRow {
  label: string;
  count: number;
  href?: string;
}

/**
 * Horizontal ranked bars for "top N" lists (cities, states, programs).
 * Dependency-free; the bar fill uses the chart-1 token.
 */
export function RankBars({
  rows,
  emptyLabel = "Sem dados ainda.",
  className,
}: {
  rows: RankRow[];
  emptyLabel?: string;
  className?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>{emptyLabel}</p>
    );
  }
  const max = Math.max(...rows.map((r) => r.count), 1);

  return (
    <ul className={cn("space-y-2.5", className)}>
      {rows.map((r) => {
        const pct = Math.max((r.count / max) * 100, 3);
        const inner = (
          <>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{r.label}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {r.count}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-chart-1"
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        );
        return (
          <li key={r.label}>
            {r.href ? (
              <Link
                href={r.href}
                className="block rounded-md px-1 py-0.5 -mx-1 transition-colors hover:bg-muted/60"
              >
                {inner}
              </Link>
            ) : (
              inner
            )}
          </li>
        );
      })}
    </ul>
  );
}
