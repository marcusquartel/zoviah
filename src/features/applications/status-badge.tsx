import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { APPLICATION_STATUS_LABELS } from "@/features/applications/status";
import type { ApplicationStatus } from "@/types/database";

const STYLES: Record<ApplicationStatus, string> = {
  new: "bg-primary-soft text-foreground",
  awaiting_review: "bg-muted text-foreground",
  information_requested: "border-[1.4px] border-input bg-transparent text-foreground",
  approved: "bg-border-strong text-foreground",
  archived: "border-[1.4px] border-input bg-transparent text-faint",
};

export function ApplicationStatusBadge({
  status,
  className,
}: {
  status: ApplicationStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("border-transparent", STYLES[status], className)}
    >
      {APPLICATION_STATUS_LABELS[status]}
    </Badge>
  );
}
