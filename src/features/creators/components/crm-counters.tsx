import type { CrmCounts } from "@/features/creators/queries";

const ITEMS: { key: keyof CrmCounts; label: string }[] = [
  { key: "total_active", label: "Ativas" },
  { key: "new", label: "Novas" },
  { key: "awaiting_review", label: "Aguardando" },
  { key: "approved", label: "Aprovadas" },
  { key: "awaiting_address", label: "Aguardando endereço" },
  { key: "completed", label: "Cadastros completos" },
];

export function CrmCounters({ counts }: { counts: CrmCounts }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
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
