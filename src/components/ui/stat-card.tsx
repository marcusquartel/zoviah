import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { RingIcon } from "@/components/ui/ring-icon";

export interface StatCardProps {
  label: string;
  value: string | number;
  /** Percentage change vs. the previous period. null hides the chip. */
  deltaPct?: number | null;
  hint?: string;
  href?: string;
  /** Icon in the top-right ring. Falls back to an arrow when `href` is set. */
  icon?: LucideIcon;
  /** Small visual (e.g. a sparkline) rendered under the value. */
  visual?: React.ReactNode;
  /** `ink`: the dark hero tile — the value is painted in the accent. */
  tone?: "default" | "ink";
  className?: string;
}

/**
 * The dashboard metric tile: label top-left, a ring icon top-right, and a
 * large light figure anchored to the bottom, with an optional delta chip.
 */
export function StatCard({
  label,
  value,
  deltaPct,
  hint,
  href,
  icon,
  visual,
  tone = "default",
  className,
}: StatCardProps) {
  const ink = tone === "ink";
  const Icon = icon ?? (href ? ArrowUpRight : null);
  const body = (
    <div
      className={cn(
        "group relative flex h-full min-h-40 flex-col rounded-[28px] p-5 transition-shadow",
        ink ? "bg-ink text-ink-foreground" : "bg-card",
        href && "hover:shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-sm leading-snug">{label}</span>
          {hint ? (
            <span
              className={cn(
                "mt-1 block text-[0.8125rem]",
                ink ? "text-ink-muted" : "text-faint",
              )}
            >
              {hint}
            </span>
          ) : null}
        </span>
        {Icon ? (
          <RingIcon
            icon={Icon}
            size={34}
            variant={ink ? "disc" : "ring"}
          />
        ) : null}
      </div>

      <div className="mt-auto pt-6">
        <span
          className={cn(
            "figure block text-[2.75rem]",
            ink && "text-primary-on-ink",
          )}
        >
          {value}
        </span>
        {deltaPct != null ? (
          <span
            className={cn(
              "mt-3 inline-flex rounded-full border-2 px-2.5 py-0.5 text-[0.78rem] tabular-nums",
              ink ? "border-ink-foreground" : "border-ink",
              deltaPct > 0 && "bg-primary text-primary-foreground",
              deltaPct <= 0 && (ink ? "bg-transparent" : "bg-muted"),
            )}
          >
            {deltaPct > 0 ? "+" : ""}
            {deltaPct}%
          </span>
        ) : null}
      </div>

      {visual ? <div className="mt-3">{visual}</div> : null}
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
