import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SHIPMENT_STATUS_LABELS } from "@/features/shipments/status";
import type { ShipmentStatus } from "@/types/database";

const STYLES: Record<ShipmentStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  preparing: "bg-warning/15 text-warning-foreground",
  shipped: "bg-primary/10 text-primary",
  delivered: "bg-success/15 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

export function ShipmentStatusBadge({
  status,
  className,
}: {
  status: ShipmentStatus;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("border-transparent", STYLES[status], className)}
    >
      {SHIPMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
