import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A titled content region — the standard container for dashboard blocks,
 * lists and charts. A borderless white card (28px radius) with a header row
 * and an optional action. `tone="ink"` renders the dark variant.
 */
export function Panel({
  title,
  description,
  action,
  children,
  className,
  bodyClassName,
  tone = "default",
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: { label: string; href: string } | React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  tone?: "default" | "ink";
}) {
  const ink = tone === "ink";
  return (
    <section
      className={cn(
        "flex flex-col rounded-[28px]",
        ink ? "bg-ink text-ink-foreground" : "bg-card",
        className,
      )}
    >
      {title || action ? (
        <header className="flex items-start justify-between gap-3 px-5 pt-5 sm:px-6">
          <div className="min-w-0">
            {title ? (
              <h2 className="font-heading text-lg leading-tight font-medium tracking-[-0.009em]">
                {title}
              </h2>
            ) : null}
            {description ? (
              <p
                className={cn(
                  "mt-1 text-[0.8125rem]",
                  ink ? "text-ink-muted" : "text-muted-foreground",
                )}
              >
                {description}
              </p>
            ) : null}
          </div>
          {action ? (
            "label" in (action as { label?: string }) &&
            (action as { href?: string }).href ? (
              <Link
                href={(action as { href: string }).href}
                className="group inline-flex shrink-0 items-center gap-2 text-[0.8125rem] transition-opacity hover:opacity-70"
              >
                {(action as { label: string }).label}
                <span
                  className={cn(
                    "inline-flex size-7 items-center justify-center rounded-full border-[1.5px]",
                    ink ? "border-ink-foreground" : "border-ink",
                  )}
                >
                  <ArrowUpRight className="size-4" strokeWidth={1.6} />
                </span>
              </Link>
            ) : (
              (action as React.ReactNode)
            )
          ) : null}
        </header>
      ) : null}
      <div className={cn("px-5 pt-4 pb-5 sm:px-6", bodyClassName)}>
        {children}
      </div>
    </section>
  );
}
