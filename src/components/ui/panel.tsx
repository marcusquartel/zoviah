import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * A titled content region — the standard container for dashboard blocks,
 * lists and charts. Lighter than <Card>: one border, a header row with an
 * optional action, and padded content.
 */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: { label: string; href: string } | React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card shadow-xs",
        className,
      )}
    >
      {title || action ? (
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            {title ? (
              <h2 className="font-heading text-sm font-semibold">{title}</h2>
            ) : null}
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action ? (
            "label" in (action as { label?: string }) && (action as { href?: string }).href ? (
              <Link
                href={(action as { href: string }).href}
                className="shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {(action as { label: string }).label} →
              </Link>
            ) : (
              (action as React.ReactNode)
            )
          ) : null}
        </header>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
