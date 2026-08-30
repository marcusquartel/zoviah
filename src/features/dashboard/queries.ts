import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { getCrmCounts } from "@/features/creators/queries";
import type { ApplicationListItem, ApplicationStatus } from "@/types/database";

/**
 * Read model for the Visão Geral dashboard (Phase 7B).
 *
 * No new RPC / view / migration: every figure comes from plain org-scoped
 * SELECTs (RLS applies) plus the existing `crm_counts` RPC. The "grouped"
 * metrics — base growth, top cities/states, programs by creator count — are
 * aggregated in JS from a single capped column fetch each. At the current
 * scale (single-digit to low-thousands rows per tenant) this is well within
 * budget; `FETCH_CAP` guards the worst case and is surfaced in the UI.
 */
const FETCH_CAP = 5000;

export type DashboardPeriodDays = 7 | 30 | 90;

export interface RankItem {
  label: string;
  count: number;
}

export interface GrowthPoint {
  /** ISO date of the bucket start. */
  date: string;
  /** Cumulative creators at the end of this bucket. */
  total: number;
  /** New creators within this bucket. */
  added: number;
}

export interface AttentionItem {
  label: string;
  count: number;
  href: string;
}

export interface DashboardOverview {
  periodDays: DashboardPeriodDays;
  capped: boolean;

  totalCreators: number;
  newCreators: number;
  newCreatorsPrev: number;
  approved: number;
  completeRegistration: number;
  activeShipments: number;

  funnel: { status: ApplicationStatus; label: string; count: number }[];
  growth: GrowthPoint[];
  growthRatePct: number | null;

  topCities: RankItem[];
  topStates: RankItem[];
  topPrograms: RankItem[];

  attention: AttentionItem[];

  latest: Pick<
    ApplicationListItem,
    "id" | "creator_name" | "program_name" | "status" | "submitted_at"
  >[];
}

const FUNNEL: { status: ApplicationStatus; label: string; key: string }[] = [
  { status: "new", label: "Nova", key: "new" },
  { status: "awaiting_review", label: "Avaliação", key: "awaiting_review" },
  { status: "information_requested", label: "Info", key: "information_requested" },
  { status: "approved", label: "Aprovada", key: "approved" },
  { status: "awaiting_address", label: "Endereço", key: "awaiting_address" },
  { status: "completed", label: "Completo", key: "completed" },
];

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

function rank(values: (string | null)[], normalize: (s: string) => string): RankItem[] {
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
    .slice(0, 5);
}

function bucketGrowth(dates: string[], periodDays: DashboardPeriodDays): GrowthPoint[] {
  const now = Date.now();
  const buckets = 12;
  const span = periodDays * 86_400_000;
  const step = span / buckets;
  const start = now - span;
  const sorted = [...dates].map((d) => new Date(d).getTime()).sort((a, b) => a - b);

  let baseline = 0;
  for (const t of sorted) if (t < start) baseline += 1;

  const points: GrowthPoint[] = [];
  let cursor = 0;
  let running = baseline;
  // advance cursor past the baseline
  while (cursor < sorted.length && sorted[cursor] < start) cursor += 1;

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

export async function getDashboardOverview(
  periodDays: DashboardPeriodDays = 30,
): Promise<DashboardOverview | null> {
  const current = await getCurrentOrganization();
  if (!current) return null;
  const orgId = current.organization.id;
  const supabase = await createClient();

  const now = Date.now();
  const since = new Date(now - periodDays * 86_400_000).toISOString();
  const prevSince = new Date(now - 2 * periodDays * 86_400_000).toISOString();

  const [
    total,
    newC,
    newPrev,
    counts,
    activeShip,
    failedAnalyses,
    creatorRows,
    appRows,
    latest,
  ] = await Promise.all([
    supabase
      .from("creators")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    supabase
      .from("creators")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", since),
    supabase
      .from("creators")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .gte("created_at", prevSince)
      .lt("created_at", since),
    getCrmCounts(),
    supabase
      .from("shipments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .in("status", ["draft", "preparing", "shipped"]),
    supabase
      .from("application_list_items")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("analysis_status", "failed"),
    supabase
      .from("creators")
      .select("city, state, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true })
      .limit(FETCH_CAP),
    supabase
      .from("application_list_items")
      .select("program_name")
      .eq("organization_id", orgId)
      .limit(FETCH_CAP),
    supabase
      .from("application_list_items")
      .select("id, creator_name, program_name, status, submitted_at")
      .eq("organization_id", orgId)
      .order("submitted_at", { ascending: false })
      .limit(6),
  ]);

  const creators = (creatorRows.data ?? []) as {
    city: string | null;
    state: string | null;
    created_at: string;
  }[];
  const apps = (appRows.data ?? []) as { program_name: string | null }[];
  const capped = creators.length >= FETCH_CAP || apps.length >= FETCH_CAP;

  const growth = bucketGrowth(
    creators.map((c) => c.created_at),
    periodDays,
  );
  const newCreators = newC.count ?? 0;
  const newCreatorsPrev = newPrev.count ?? 0;
  const growthRatePct =
    newCreatorsPrev > 0
      ? Math.round(((newCreators - newCreatorsPrev) / newCreatorsPrev) * 100)
      : null;

  // `crm_counts` also returns `possible_duplicate` at runtime (not in the
  // typed CrmCounts interface), so read it through a loose map.
  const cr = counts as unknown as Record<string, number>;
  const funnel = FUNNEL.map((f) => ({
    status: f.status,
    label: f.label,
    count: cr[f.key] ?? 0,
  }));

  const attention: AttentionItem[] = [];
  if ((cr.possible_duplicate ?? 0) > 0) {
    attention.push({
      label: "Possíveis duplicadas",
      count: cr.possible_duplicate,
      href: "/app/creators?dup=1",
    });
  }
  if ((cr.awaiting_address ?? 0) > 0) {
    attention.push({
      label: "Aguardando endereço",
      count: cr.awaiting_address,
      href: "/app/creators?status=awaiting_address",
    });
  }
  if ((failedAnalyses.count ?? 0) > 0) {
    attention.push({
      label: "Análises que falharam",
      count: failedAnalyses.count ?? 0,
      href: "/app/creators?analysis=failed",
    });
  }

  return {
    periodDays,
    capped,
    totalCreators: total.count ?? 0,
    newCreators,
    newCreatorsPrev,
    approved: cr.approved ?? 0,
    completeRegistration: cr.completed ?? 0,
    activeShipments: activeShip.count ?? 0,
    funnel,
    growth,
    growthRatePct,
    topCities: rank(
      creators.map((c) => c.city),
      titleCase,
    ),
    topStates: rank(
      creators.map((c) => c.state),
      (s) => (s.length === 2 ? s.toUpperCase() : titleCase(s)),
    ),
    topPrograms: rank(
      apps.map((a) => a.program_name),
      (s) => s,
    ),
    attention,
    latest: (latest.data ?? []) as DashboardOverview["latest"],
  };
}
