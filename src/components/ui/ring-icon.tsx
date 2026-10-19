import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The identity's icon mark: a lucide glyph inside a circle.
 *  - `ring`  — hairline ink outline (default; on white / paper).
 *  - `disc`  — filled with the accent (`--primary`), glyph in its foreground.
 *  - `ink`   — filled with ink, white glyph.
 *  - `light` — hairline white outline, for use on ink cards.
 */
export function RingIcon({
  icon: Icon,
  size = 36,
  variant = "ring",
  className,
}: {
  icon: LucideIcon;
  size?: number;
  variant?: "ring" | "disc" | "ink" | "light";
  className?: string;
}) {
  const glyph = Math.round(size * (variant === "ring" || variant === "light" ? 0.5 : 0.46));
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        variant === "ring" && "border-[1.5px] border-ink text-ink",
        variant === "light" && "border-[1.5px] border-ink-foreground text-ink-foreground",
        variant === "disc" && "bg-primary text-primary-foreground",
        variant === "ink" && "bg-ink text-ink-foreground",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Icon style={{ width: glyph, height: glyph }} strokeWidth={1.6} />
    </span>
  );
}
