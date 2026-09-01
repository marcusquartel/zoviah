/**
 * Pure aggregation helpers for the Visão Geral dashboard. No I/O — unit-tested
 * in `tests/dashboard.test.ts`. The DB query module (`queries.ts`) fetches raw
 * columns and delegates the "grouped" figures here.
 */

export interface RankItem {
  label: string;
  count: number;
}

export interface GrowthPoint {
  date: string;
  total: number;
  added: number;
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Normalise a UF: 2-letter → upper-case, longer → title-case. */
export function normalizeState(s: string): string {
  const t = s.trim();
  return t.length === 2 ? t.toUpperCase() : titleCase(t);
}

/** Top-5 by count, ties broken alphabetically. Blank values are ignored. */
export function rank(
  values: (string | null | undefined)[],
  normalize: (s: string) => string = (s) => s,
  limit = 5,
): RankItem[] {
  const counts = new Map<string, number>();
  for (const v of values) {
    const t = (v ?? "").trim();
    if (!t) continue;
    const key = normalize(t);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/**
 * Bucket a list of ISO creation dates into `buckets` equal windows ending
 * "now", returning the cumulative total (including everything before the
 * window) and the count added per bucket.
 */
export function bucketGrowth(
  isoDates: string[],
  periodDays: number,
  now: number = Date.now(),
  buckets = 12,
): GrowthPoint[] {
  const span = periodDays * 86_400_000;
  const step = span / buckets;
  const start = now - span;
  const sorted = isoDates
    .map((d) => new Date(d).getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);

  let cursor = 0;
  let running = 0;
  while (cursor < sorted.length && sorted[cursor] < start) {
    running += 1;
    cursor += 1;
  }

  const points: GrowthPoint[] = [];
  for (let i = 0; i < buckets; i += 1) {
    const edge = start + step * (i + 1);
    let added = 0;
    while (cursor < sorted.length && sorted[cursor] < edge) {
      added += 1;
      cursor += 1;
    }
    running += added;
    points.push({ date: new Date(edge).toISOString(), total: running, added });
  }
  return points;
}

/** Signed % change; null when the previous value was 0 (no baseline). */
export function growthRatePct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export interface AttentionItem {
  label: string;
  count: number;
  href: string;
}

/**
 * Operational "needs a look" items for the dashboard. Deliberately excludes
 * possible-duplicate applications — that lives in the CRM, not here. Order is
 * fixed: missing address first (blocks shipping), then failed analyses.
 */
export function buildAttention(
  crm: Record<string, number>,
  failedAnalyses: number,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  if ((crm.awaiting_address ?? 0) > 0) {
    items.push({
      label: "Aguardando endereço",
      count: crm.awaiting_address,
      href: "/app/creators?status=awaiting_address",
    });
  }
  if (failedAnalyses > 0) {
    items.push({
      label: "Análises que falharam",
      count: failedAnalyses,
      href: "/app/creators?analysis=failed",
    });
  }
  return items;
}
