import { Building2 } from "lucide-react";
import { PRODUCT } from "@/config/product";

interface OrgBadgeProps {
  name: string;
  logoUrl?: string | null;
}

export function OrgBadge({ name, logoUrl }: OrgBadgeProps) {
  return (
    <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-4">
      {logoUrl ? (
        // The client's logo already carries the brand name — don't repeat it
        // as text next to it. Just the mark + a small "by Zoviah".
        <div className="min-w-0 text-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={name}
            className="h-8 w-auto max-w-[160px] object-contain"
          />
          <p className="mt-1 text-[0.6875rem] text-muted-foreground">
            by {PRODUCT.name}
          </p>
        </div>
      ) : (
        <>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-semibold tracking-tight">
              {name}
            </p>
            <p className="text-[0.6875rem] text-muted-foreground">
              by {PRODUCT.name}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
