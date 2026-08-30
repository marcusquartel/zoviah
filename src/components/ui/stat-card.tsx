import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string | number;
  /** Percentage change vs. the previous period. null hides the chip. */
  deltaPct?: number | null;
  hint?: string;
  href?: string;
  /** Small visual (e.g. a sparkline) rendered under the value. */
  visual?: React.ReactNode;
  className?: string;
}

/**
 * The dashboard metric tile. Premium, restrained: an eyebrow label, a large
 * tabular figure, an optional signed delta chip, an optional visual, and an
 * optional "open" affordance when `href` is set.
 */
export function StatCard({
  label,
  value,
  deltaPct,
  hint,
  href,
  visual,
  className,
}: StatCardProps) {
  const body = (
    <div
      className={cn(
        "group relative flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-xs transition-colors",
        href && "hover:border-border-strong",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="eyebrow">{label}</span>
        {href ? (
          <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
        ) : null}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-[1.75rem] leading-none font-semibold tabular-nums tracking-tight">
          {value}
        </span>
        {deltaPct != null ? (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[0.6875rem] font-medium tabular-nums",
              deltaPct > 0 && "bg-success/12 text-success",
              deltaPct < 0 && "bg-danger/12 text-danger",
              deltaPct === 0 && "bg-muted text-muted-foreground",
            )}
          >
            {deltaPct > 0 ? "+" : ""}
            {deltaPct}%
          </span>
        ) : null}
      </div>

      {visual ? <div className="mt-auto pt-1">{visual}</div> : null}
      {hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block h-full">
        {body}
      </Link>
    );
  }
  return body;
}
