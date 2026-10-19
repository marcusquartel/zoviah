import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { APPLICATION_STATUS_LABELS } from "@/features/applications/status";
import type { ApplicationStatus } from "@/types/database";

const STYLES: Record<ApplicationStatus, string> = {
  new: "bg-primary/10 text-primary",
  awaiting_review: "bg-warning/15 text-warning-foreground",
  information_requested: "bg-accent text-accent-foreground",
  approved: "bg-success/15 text-success",
  archived: "bg-muted text-muted-foreground",
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
