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
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
      {ITEMS.map((item) => (
        <div
          key={item.key}
          className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-xs"
        >
          <p className="text-xl leading-none font-semibold tabular-nums tracking-tight">
            {counts[item.key]}
          </p>
          <p className="mt-1.5 eyebrow">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
