const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** "R$ 1.234,56" (other currencies fall back to their own code). */
export function formatMoney(value: number | string | null | undefined, currency = "BRL"): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "—";
  if (currency === "BRL") return brl.format(n);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
}

export function formatPercent(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
}
