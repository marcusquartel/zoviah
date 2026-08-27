import { Building2 } from "lucide-react";

interface OrgBadgeProps {
  name: string;
  logoUrl?: string | null;
}

export function OrgBadge({ name, logoUrl }: OrgBadgeProps) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={name}
            className="size-8 rounded-md object-cover"
          />
        ) : (
          <Building2 className="size-4" />
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground">Creator Hub</p>
      </div>
    </div>
  );
}
