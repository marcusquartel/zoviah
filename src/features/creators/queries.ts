import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import type { CreatorQuery } from "@/lib/query-state";
import type {
  Application,
  ApplicationListItem,
  Creator,
  CreatorEvent,
  CreatorSocialProfile,
} from "@/types/database";

export const PAGE_SIZE = 50;

export interface CrmCounts {
  total_active: number;
  new: number;
  awaiting_review: number;
  information_requested: number;
  approved: number;
  awaiting_address: number;
  completed: number;
  archived: number;
  possible_duplicate: number;
}

const EMPTY_COUNTS: CrmCounts = {
  total_active: 0,
  new: 0,
  awaiting_review: 0,
  information_requested: 0,
  approved: 0,
  awaiting_address: 0,
  completed: 0,
  archived: 0,
  possible_duplicate: 0,
};

export async function getCrmCounts(
  programId?: string | null,
): Promise<CrmCounts> {
  const current = await getCurrentOrganization();
  if (!current) return EMPTY_COUNTS;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("crm_counts", {
    p_program_id: programId ?? undefined,
  });
  if (error || !data) return EMPTY_COUNTS;
  return { ...EMPTY_COUNTS, ...(data as Partial<CrmCounts>) };
}

/** PostgREST `.or()` breaks on these; a search term never needs them. */
function sanitizeSearch(q: string): string {
  return q.replace(/[,()*:%\\]/g, " ").trim().slice(0, 80);
}

export interface ApplicationListPage {
  items: ApplicationListItem[];
  hasMore: boolean;
  page: number;
}

/**
 * The CRM list. One query against the `application_list_items` view (which
 * flattens creator + program + top IG/TikTok profile), so no N+1. Offset
 * pagination, 50/page; fetches one extra row to know if there's a next page.
 */
export async function listApplicationItems(
  query: CreatorQuery,
  options: { pageSize?: number } = {},
): Promise<ApplicationListPage> {
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const current = await getCurrentOrganization();
  if (!current) return { items: [], hasMore: false, page: 1 };

  const supabase = await createClient();
  let q = supabase
    .from("application_list_items")
    .select("*")
    .eq("organization_id", current.organization.id);

  if (query.program) q = q.eq("program_id", query.program);
  if (query.status) q = q.eq("status", query.status);
  if (query.duplicate) q = q.eq("possible_duplicate", true);
  if (query.city) q = q.ilike("creator_city", `%${query.city}%`);
  if (query.state) q = q.ilike("creator_state", `%${query.state}%`);
  if (query.hasInstagram) q = q.not("instagram_handle", "is", null);
  if (query.hasTiktok) q = q.not("tiktok_handle", "is", null);
  if (query.analysisStatus) q = q.eq("analysis_status", query.analysisStatus);
  if (query.tier) q = q.eq("current_tier", query.tier);
  if (query.confidence) q = q.eq("analysis_confidence", query.confidence);
  if (query.minScore != null) q = q.gte("current_score", query.minScore);

  const term = sanitizeSearch(query.q);
  if (term) {
    q = q.or(
      [
        `creator_name.ilike.*${term}*`,
        `creator_preferred_name.ilike.*${term}*`,
        `creator_email.ilike.*${term}*`,
        `creator_phone.ilike.*${term}*`,
        `instagram_handle_normalized.ilike.*${term}*`,
        `tiktok_handle_normalized.ilike.*${term}*`,
      ].join(","),
    );
  }

  switch (query.sort) {
    case "oldest":
      q = q.order("submitted_at", { ascending: true });
      break;
    case "name_asc":
      q = q.order("creator_name", { ascending: true });
      break;
    case "name_desc":
      q = q.order("creator_name", { ascending: false });
      break;
    case "ig_desc":
      q = q.order("instagram_followers", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "tt_desc":
      q = q.order("tiktok_followers", { ascending: false, nullsFirst: false });
      break;
    case "score_desc":
      q = q.order("current_score", { ascending: false, nullsFirst: false });
      break;
    case "score_asc":
      q = q.order("current_score", { ascending: true, nullsFirst: false });
      break;
    default:
      q = q.order("submitted_at", { ascending: false });
  }
  q = q.order("id", { ascending: false });

  const from = (query.page - 1) * pageSize;
  q = q.range(from, from + pageSize); // pageSize + 1 rows

  const { data, error } = await q;
  if (error || !data) return { items: [], hasMore: false, page: query.page };

  return {
    items: data.slice(0, pageSize),
    hasMore: data.length > pageSize,
    page: query.page,
  };
}

// ---------------------------------------------------------------------------
// Drawer detail (loaded on demand)
// ---------------------------------------------------------------------------
export interface OtherApplication {
  id: string;
  program_name: string;
  status: ApplicationListItem["status"];
  submitted_at: string;
}

export interface ApplicationDetail {
  application: Application;
  program: { id: string; name: string; slug: string };
  creator: Creator;
  socials: CreatorSocialProfile[];
  otherApplications: OtherApplication[];
}

export const getApplicationDetail = cache(
  async (applicationId: string): Promise<ApplicationDetail | null> => {
    const current = await getCurrentOrganization();
    if (!current) return null;
    const orgId = current.organization.id;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("applications")
      .select("*, programs(id, name, slug), creators(*)")
      .eq("organization_id", orgId)
      .eq("id", applicationId)
      .maybeSingle();

    if (error || !data || !data.programs || !data.creators) return null;

    const { programs, creators, ...application } = data;

    const [{ data: socials }, { data: others }] = await Promise.all([
      supabase
        .from("creator_social_profiles")
        .select("*")
        .eq("organization_id", orgId)
        .eq("creator_id", creators.id)
        .order("platform", { ascending: true }),
      supabase
        .from("application_list_items")
        .select("id, program_name, status, submitted_at")
        .eq("organization_id", orgId)
        .eq("creator_id", creators.id)
        .neq("id", applicationId)
        .order("submitted_at", { ascending: false })
        .limit(20),
    ]);

    return {
      application: application as Application,
      program: programs,
      creator: creators,
      socials: socials ?? [],
      otherApplications: (others ?? []) as OtherApplication[],
    };
  },
);

export const getCreatorTimeline = cache(
  async (creatorId: string, limit = 50): Promise<CreatorEvent[]> => {
    const current = await getCurrentOrganization();
    if (!current) return [];
    const supabase = await createClient();
    const { data } = await supabase
      .from("creator_events")
      .select("*")
      .eq("organization_id", current.organization.id)
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false })
      .limit(limit);
    return data ?? [];
  },
);

// ---------------------------------------------------------------------------
// Overview (/app) — real numbers
// ---------------------------------------------------------------------------
export interface OverviewStats {
  creators: number;
  applications: number;
  new: number;
  approved: number;
  activePrograms: number;
  latest: Pick<
    ApplicationListItem,
    "id" | "creator_name" | "program_name" | "status" | "submitted_at"
  >[];
}

export async function getOverviewStats(): Promise<OverviewStats | null> {
  const current = await getCurrentOrganization();
  if (!current) return null;
  const orgId = current.organization.id;
  const supabase = await createClient();

  const [creators, applications, counts, programs, latest] = await Promise.all([
    supabase
      .from("creators")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    getCrmCounts(),
    supabase
      .from("programs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "active"),
    supabase
      .from("application_list_items")
      .select("id, creator_name, program_name, status, submitted_at")
      .eq("organization_id", orgId)
      .order("submitted_at", { ascending: false })
      .limit(6),
  ]);

  return {
    creators: creators.count ?? 0,
    applications: applications.count ?? 0,
    new: counts.new,
    approved: counts.approved,
    activePrograms: programs.count ?? 0,
    latest: (latest.data ?? []) as OverviewStats["latest"],
  };
}
