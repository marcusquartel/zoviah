import type { ShipmentCounts } from "@/features/shipments/queries";

const ITEMS: { key: keyof ShipmentCounts; label: string }[] = [
  { key: "open", label: "Em aberto" },
  { key: "preparing", label: "Preparando" },
  { key: "shipped", label: "Enviados" },
  { key: "delivered", label: "Entregues" },
  { key: "cancelled", label: "Cancelados" },
];

export function ShipmentCounters({ counts }: { counts: ShipmentCounts }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {ITEMS.map((item) => (
        <div key={item.key} className="rounded-lg border bg-card px-3 py-2">
          <p className="text-xl font-semibold tabular-nums">
            {counts[item.key]}
          </p>
          <p className="text-xs text-muted-foreground">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
