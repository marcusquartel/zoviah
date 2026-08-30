import { Building2 } from "lucide-react";

interface OrgBadgeProps {
  name: string;
  logoUrl?: string | null;
}

export function OrgBadge({ name, logoUrl }: OrgBadgeProps) {
  return (
    <div className="flex items-center gap-2.5 border-b border-sidebar-border px-4 py-4">
      <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-xs">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={name} className="size-9 object-cover" />
        ) : (
          <Building2 className="size-4" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold tracking-tight">{name}</p>
        <p className="text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground">
          Creator Hub
        </p>
      </div>
    </div>
  );
}
