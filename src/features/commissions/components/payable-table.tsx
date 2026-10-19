"use client";

import { useMemo, useState, useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markCommissionsPaid } from "@/features/shopify/actions";
import { formatMoney, formatPercent } from "@/lib/money";
import { formatDate } from "@/features/creators/format";

export interface PayableRow {
  id: string;
  creator_name: string;
  code: string | null;
  order_name: string | null;
  processed_at: string;
  base_amount: number;
  rate: number;
  amount: number;
}

function toCsv(rows: PayableRow[]): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const head = ["Creator", "Código", "Pedido", "Data", "Base", "Comissão %", "Valor"];
  const lines = rows.map((r) =>
    [r.creator_name, r.code ?? "", r.order_name ?? "", formatDate(r.processed_at), r.base_amount.toFixed(2), r.rate, r.amount.toFixed(2)]
      .map(esc)
      .join(";"),
  );
  return "﻿" + [head.map(esc).join(";"), ...lines].join("\n");
}

export function PayableTable({ rows, canPay }: { rows: PayableRow[]; canPay: boolean }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const total = useMemo(
    () => rows.filter((r) => selected.has(r.id)).reduce((s, r) => s + r.amount, 0),
    [rows, selected],
  );
  const all = selected.size === rows.length && rows.length > 0;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const pick = selected.size ? rows.filter((r) => selected.has(r.id)) : rows;
    const blob = new Blob([toCsv(pick)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `comissoes-a-pagar-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma comissão liberada para pagamento.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
        <label className="flex items-center gap-2.5 text-sm">
          <input
            type="checkbox"
            className="size-4 accent-[var(--primary)]"
            checked={all}
            onChange={() => setSelected(all ? new Set() : new Set(rows.map((r) => r.id)))}
          />
          {selected.size ? `${selected.size} selecionada(s) · ${formatMoney(total)}` : "Selecionar todas"}
        </label>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download /> Exportar CSV
          </Button>
          {canPay ? (
            <Button
              disabled={!selected.size || pending}
              onClick={() => {
                if (!window.confirm(`Marcar ${selected.size} comissão(ões) como paga(s), total ${formatMoney(total)}?`)) return;
                startTransition(async () => {
                  const res = await markCommissionsPaid([...selected]);
                  if (res.ok) {
                    toast.success(res.message ?? "Pago.");
                    setSelected(new Set());
                  } else toast.error(res.error ?? "Erro.");
                });
              }}
            >
              {pending ? "Salvando…" : "Marcar como pagas"}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-[0.8125rem] text-faint">
              <th className="w-8 py-3" />
              <th className="px-3 py-3 font-normal">Creator</th>
              <th className="px-3 py-3 font-normal">Pedido</th>
              <th className="px-3 py-3 font-normal">Data</th>
              <th className="px-3 py-3 text-right font-normal">Base</th>
              <th className="px-3 py-3 text-right font-normal">%</th>
              <th className="px-3 py-3 text-right font-normal">Comissão</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="py-3.5">
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${r.order_name ?? r.id}`}
                    className="size-4 accent-[var(--primary)]"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                </td>
                <td className="px-3 py-3.5">
                  {r.creator_name}
                  {r.code ? <span className="ml-2 text-faint">{r.code}</span> : null}
                </td>
                <td className="px-3 py-3.5">{r.order_name ?? "—"}</td>
                <td className="px-3 py-3.5 text-muted-foreground">{formatDate(r.processed_at)}</td>
                <td className="px-3 py-3.5 text-right tabular-nums">{formatMoney(r.base_amount)}</td>
                <td className="px-3 py-3.5 text-right tabular-nums">{formatPercent(r.rate)}</td>
                <td className="px-3 py-3.5 text-right font-medium tabular-nums">{formatMoney(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
