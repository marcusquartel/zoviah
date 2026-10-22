import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** The creator's categoria (creator_tiers.name) on CRM rows and cards. */
export function TierBadge({ name, className }: { name: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("h-5 px-2 text-[0.7rem]", className)}>
      {name}
    </Badge>
  );
}
