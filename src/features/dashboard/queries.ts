import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { getCrmCounts } from "@/features/creators/queries";
import {
  buildAttention,
  bucketGrowth,
  growthRatePct,
  normalizeState,
  rank,
  titleCase,
  type AttentionItem,
  type GrowthPoint,
  type RankItem,
} from "@/features/dashboard/aggregate";
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

export type { RankItem, GrowthPoint, AttentionItem };

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

  // `crm_counts` also returns `possible_duplicate` at runtime (not in the
  // typed CrmCounts interface), so read it through a loose map.
  const cr = counts as unknown as Record<string, number>;
  const funnel = FUNNEL.map((f) => ({
    status: f.status,
    label: f.label,
    count: cr[f.key] ?? 0,
  }));

  const attention = buildAttention(cr, failedAnalyses.count ?? 0);

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
    growthRatePct: growthRatePct(newCreators, newCreatorsPrev),
    topCities: rank(
      creators.map((c) => c.city),
      titleCase,
    ),
    topStates: rank(
      creators.map((c) => c.state),
      normalizeState,
    ),
    topPrograms: rank(apps.map((a) => a.program_name)),
    attention,
    latest: (latest.data ?? []) as DashboardOverview["latest"],
  };
}
