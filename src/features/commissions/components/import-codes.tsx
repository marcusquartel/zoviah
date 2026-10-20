"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { importAffiliations, loadImportableCodes, type ImportableCode } from "@/features/shopify/actions";
import { formatMoney, formatPercent } from "@/lib/money";

interface RowState {
  selected: boolean;
  name: string;
  rate: string;
  instagram: string;
}

/** "ESTEFANYSANTOSRW" → "Estefanysantos": a starting point the user edits. */
function nameFromCode(code: string): string {
  const base = code.replace(/(RW)?\d*$/i, "") || code;
  return base.charAt(0).toUpperCase() + base.slice(1).toLowerCase();
}

export function ImportCodes() {
  const router = useRouter();
  const [codes, setCodes] = useState<ImportableCode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [defaultRate, setDefaultRate] = useState("10");
  const [query, setQuery] = useState("");
  const [onlyUsed, setOnlyUsed] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let active = true;
    void loadImportableCodes().then((r) => {
      if (!active) return;
      if (r.ok) setCodes(r.codes ?? []);
      else setError(r.error ?? "Não foi possível ler os cupons.");
    });
    return () => {
      active = false;
    };
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toUpperCase();
    return (codes ?? []).filter((c) => (!q || c.code.toUpperCase().includes(q)) && (!onlyUsed || c.orders > 0));
  }, [codes, query, onlyUsed]);

  const selected = (codes ?? []).filter((c) => rows[c.code]?.selected);

  function row(code: string): RowState {
    return rows[code] ?? { selected: false, name: nameFromCode(code), rate: defaultRate, instagram: "" };
  }
  function patch(code: string, p: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [code]: { ...row(code), ...p } }));
  }

  function submit() {
    const items = selected.map((c) => {
      const r = row(c.code);
      return {
        name: r.name,
        code: c.code,
        commissionRate: Number(r.rate.replace(",", ".")),
        discountPercent: c.percent,
        shopifyDiscountId: c.id,
        instagram: r.instagram || undefined,
      };
    });
    startTransition(async () => {
      const res = await importAffiliations(items);
      if (res.ok) {
        toast.success(res.message ?? "Importado.");
        router.push("/app/commissions");
      } else toast.error(res.error ?? "Não foi possível importar.");
    });
  }

  if (error) {
    return <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>;
  }
  if (!codes) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full rounded-[28px]" />
        <Skeleton className="h-96 w-full rounded-[28px]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-[28px] bg-card p-4">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar cupom" className="pl-10" />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={onlyUsed} onChange={(e) => setOnlyUsed(e.target.checked)} />
          Só cupons com vendas
        </label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Comissão padrão
          <Input className="w-20" inputMode="decimal" value={defaultRate} onChange={(e) => setDefaultRate(e.target.value)} />
          %
        </label>
      </div>

      <div className="rounded-[28px] bg-card px-3 py-2 sm:px-4">
        {visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {codes.length === 0 ? "Todos os cupons da loja já estão vinculados." : "Nenhum cupom encontrado."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="text-left text-[0.8125rem] text-faint">
                  <th className="w-10 py-3" />
                  <th className="px-3 py-3 font-normal">Cupom</th>
                  <th className="px-3 py-3 text-right font-normal">Desconto</th>
                  <th className="px-3 py-3 text-right font-normal">Pedidos</th>
                  <th className="px-3 py-3 text-right font-normal">Vendas</th>
                  <th className="px-3 py-3 font-normal">Nome da influenciadora</th>
                  <th className="px-3 py-3 font-normal">Instagram</th>
                  <th className="px-3 py-3 font-normal">Comissão</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => {
                  const r = row(c.code);
                  return (
                    <tr key={c.id} className={`border-t border-border ${r.selected ? "bg-accent" : ""}`}>
                      <td className="py-3 pl-2">
                        <input
                          type="checkbox"
                          aria-label={`Importar ${c.code}`}
                          className="size-4 accent-[var(--primary)]"
                          checked={r.selected}
                          onChange={(e) => patch(c.code, { selected: e.target.checked, rate: rows[c.code]?.rate ?? defaultRate })}
                        />
                      </td>
                      <td className="px-3 py-3">
                        <span className="font-medium">{c.code}</span>
                        {c.status && c.status !== "ACTIVE" ? <span className="ml-2 text-[0.75rem] text-faint">{c.status.toLowerCase()}</span> : null}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">{c.percent != null ? formatPercent(c.percent) : "—"}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{c.orders}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{c.orders ? formatMoney(c.sales) : "—"}</td>
                      <td className="px-3 py-2">
                        <Input
                          value={r.name}
                          disabled={!r.selected}
                          onChange={(e) => patch(c.code, { name: e.target.value })}
                          className="h-9 min-w-48"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={r.instagram}
                          disabled={!r.selected}
                          placeholder="@perfil"
                          onChange={(e) => patch(c.code, { instagram: e.target.value })}
                          className="h-9 w-36"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-1.5">
                          <Input
                            value={r.rate}
                            disabled={!r.selected}
                            inputMode="decimal"
                            onChange={(e) => patch(c.code, { rate: e.target.value })}
                            className="h-9 w-16"
                          />
                          <span className="text-muted-foreground">%</span>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-full bg-card py-2.5 pr-2.5 pl-5 shadow-lg">
        <span className="text-sm text-muted-foreground">
          {selected.length
            ? `${selected.length} cupom(ns) selecionado(s) — o cupom existente é vinculado, nada é criado na loja.`
            : "Marque os cupons que pertencem a influenciadoras."}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => router.push("/app/commissions")}>
            Cancelar
          </Button>
          <Button disabled={!selected.length || pending} onClick={submit}>
            {pending ? "Importando…" : `Importar ${selected.length || ""}`.trim()}
          </Button>
        </div>
      </div>
    </div>
  );
}
