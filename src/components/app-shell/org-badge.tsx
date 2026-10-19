import { BrandLogo } from "@/components/brand-logo";
import { PRODUCT } from "@/config/product";

interface OrgBadgeProps {
  name: string;
  logoUrl?: string | null;
}

export function OrgBadge({ name, logoUrl }: OrgBadgeProps) {
  return (
    <div className="flex items-center gap-3 px-2 pb-7">
      {logoUrl ? (
        // The client's logo already carries the brand name — don't repeat it
        // as text next to it. Just the mark + a small "by Zoviah".
        <div className="min-w-0 text-left">
          <BrandLogo src={logoUrl} alt={name} size="sm" />
          <p className="mt-1.5 text-[0.75rem] text-faint">by {PRODUCT.name}</p>
        </div>
      ) : (
        <>
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-[0.95rem] font-medium text-ink-foreground">
            {name.trim().charAt(0).toUpperCase() || "Z"}
          </div>
          <div className="min-w-0 text-left">
            <p className="truncate text-[0.95rem] font-medium tracking-[-0.004em]">
              {name}
            </p>
            <p className="text-[0.75rem] text-faint">by {PRODUCT.name}</p>
          </div>
        </>
      )}
    </div>
  );
}
