"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import type { PortalRankingRow } from "@/features/portal/types";

export function RankingTabs({
  all,
  tier,
  tierName,
  accent,
}: {
  all: PortalRankingRow[];
  tier: PortalRankingRow[] | null;
  tierName: string | null;
  /** Brand color for her row / the active tab. */
  accent: string;
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
                tab === id ? "font-medium text-white" : "text-muted-foreground hover:text-foreground",
              )}
              style={tab === id ? { background: accent } : undefined}
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
              className={cn("flex items-center gap-3 px-3 py-2 text-sm", r.me && "font-semibold")}
              style={r.me ? { background: `${accent}22` } : undefined}
            >
              <span className="w-8 shrink-0 text-right text-base font-semibold tabular-nums">
                {r.active && r.position <= 3 ? ["🥇", "🥈", "🥉"][r.position - 1] : `${r.position}º`}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">
                  {r.name}
                  {r.me ? (
                    <span className="ml-1 text-xs font-medium" style={{ color: accent }}>
                      (você)
                    </span>
                  ) : null}
                </span>
                {r.me && r.sales != null ? (
                  <span className="block text-xs font-medium tabular-nums text-muted-foreground">
                    {formatMoney(r.sales)} · {r.orders} {r.orders === 1 ? "venda" : "vendas"}
                  </span>
                ) : null}
              </span>
              {tab === "all" && r.tier ? (
                <span className="shrink-0 text-xs text-muted-foreground">{r.tier}</span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
