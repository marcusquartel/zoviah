"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import type { PortalRankingRow } from "@/features/portal/types";

export function RankingTabs({
  all,
  tier,
  tierName,
}: {
  all: PortalRankingRow[];
  tier: PortalRankingRow[] | null;
  tierName: string | null;
}) {
  const [tab, setTab] = useState<"all" | "tier">("all");
  const rows = tab === "tier" && tier ? tier : all;

  return (
    <div className="space-y-3">
      {tier && tierName ? (
        <div className="inline-flex rounded-lg border p-0.5 text-sm">
          {(
            [
              ["all", "Geral"],
              ["tier", tierName],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={cn(
                "rounded-md px-3 py-1",
                tab === id ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">Ranking ainda vazio.</p>
      ) : (
        <ol className="divide-y rounded-lg border">
          {rows.map((r, i) => (
            <li
              key={`${r.position}-${r.name}-${i}`}
              className={cn("flex items-center gap-3 px-3 py-2 text-sm", r.me && "bg-primary/10")}
            >
              <span className="w-8 shrink-0 text-right font-semibold tabular-nums">{r.position}º</span>
              <span className="min-w-0 flex-1 truncate">
                {r.name}
                {r.me ? <span className="ml-1 text-xs font-medium text-primary">(você)</span> : null}
              </span>
              {tab === "all" && r.tier ? (
                <span className="shrink-0 text-xs text-muted-foreground">{r.tier}</span>
              ) : null}
              {r.me && r.sales != null ? (
                <span className="shrink-0 text-xs font-medium tabular-nums">
                  {formatMoney(r.sales)} · {r.orders} {r.orders === 1 ? "venda" : "vendas"}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
