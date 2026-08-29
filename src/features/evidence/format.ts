import type { MetricSource } from "@/types/database";

const nf0 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** "—" for null/undefined — never show 0 for "unknown" (§34, §52). */
export const fmtInt = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n) ? "—" : nf0.format(Math.round(n));

export const fmtDecimal = (n: number | null | undefined): string =>
  n == null || !Number.isFinite(n) ? "—" : nf1.format(n);

/** A ratio (0..1) as a percentage: 0.412 -> "41,2%". */
export const fmtPct = (r: number | null | undefined): string =>
  r == null || !Number.isFinite(r) ? "—" : `${nf1.format(r * 100)}%`;

export const fmtPctSigned = (r: number | null | undefined): string => {
  if (r == null || !Number.isFinite(r)) return "—";
  return `${r > 0 ? "+" : ""}${nf1.format(r * 100)}%`;
};

/** Provenance only — NOT a quality signal, NOT a score input (§7). */
export const SOURCE_LABELS: Record<MetricSource, string> = {
  declared: "Informado no cadastro",
  admin_manual: "Registro manual",
  creator_provided: "Enviado pela creator",
  import: "Importado",
  api: "API",
};

export const SOURCE_OPTIONS: { value: MetricSource; label: string }[] = [
  { value: "admin_manual", label: SOURCE_LABELS.admin_manual },
  { value: "creator_provided", label: SOURCE_LABELS.creator_provided },
  { value: "declared", label: SOURCE_LABELS.declared },
  { value: "import", label: SOURCE_LABELS.import },
  { value: "api", label: SOURCE_LABELS.api },
];

export function relativeDays(days: number): string {
  if (days <= 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 30) return `há ${days} dias`;
  if (days < 60) return "há cerca de 1 mês";
  return `há cerca de ${Math.round(days / 30)} meses`;
}

/** UX-only staleness flag (§54). No effect on any score. */
export const STALE_AFTER_DAYS = 90;
