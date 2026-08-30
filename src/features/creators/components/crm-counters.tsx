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
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
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
