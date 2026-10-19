import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { getApplicationDetail } from "@/features/creators/queries";
import {
  deriveSnapshotMetrics,
  type DerivedMetrics,
} from "@/features/evidence/metrics";
import type {
  CreatorSocialProfile,
  SocialMetricSnapshot,
} from "@/types/database";

const HISTORY_PAGE = 10;

export interface ProfileMetrics {
  profile: CreatorSocialProfile;
  latest: SocialMetricSnapshot | null;
  previous: SocialMetricSnapshot | null;
  derived: DerivedMetrics | null;
  history: SocialMetricSnapshot[];
  historyTotal: number;
}

export interface ApplicationMetrics {
  creatorId: string;
  profiles: ProfileMetrics[];
}

/** Everything the Métricas tab needs. Loaded on demand (§40, §72). */
export async function getApplicationMetrics(
  applicationId: string,
): Promise<ApplicationMetrics | null> {
  const current = await getCurrentOrganization();
  if (!current) return null;
  const detail = await getApplicationDetail(applicationId);
  if (!detail) return null;

  const supabase = await createClient();
  const orgId = current.organization.id;

  const profiles = await Promise.all(
    detail.socials.map(async (profile) => {
      const [{ data: recent }, { count }] = await Promise.all([
        supabase
          .from("social_metric_snapshots")
          .select("*")
          .eq("organization_id", orgId)
          .eq("social_profile_id", profile.id)
          .order("observed_at", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(HISTORY_PAGE + 1),
        supabase
          .from("social_metric_snapshots")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("social_profile_id", profile.id),
      ]);

      const history = (recent ?? []).slice(0, HISTORY_PAGE);
      const latest = history[0] ?? null;
      const previous = history[1] ?? null;

      return {
        profile,
        latest,
        previous,
        derived: latest ? deriveSnapshotMetrics(latest, previous) : null,
        history,
        historyTotal: count ?? 0,
      } satisfies ProfileMetrics;
    }),
  );

  return { creatorId: detail.creator.id, profiles };
}

export async function getSnapshotHistoryPage(
  profileId: string,
  page: number,
): Promise<{ items: SocialMetricSnapshot[]; hasMore: boolean }> {
  const current = await getCurrentOrganization();
  if (!current) return { items: [], hasMore: false };
  const supabase = await createClient();
  const from = (page - 1) * HISTORY_PAGE;
  const { data } = await supabase
    .from("social_metric_snapshots")
    .select("*")
    .eq("organization_id", current.organization.id)
    .eq("social_profile_id", profileId)
    .order("observed_at", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + HISTORY_PAGE);
  const rows = data ?? [];
  return { items: rows.slice(0, HISTORY_PAGE), hasMore: rows.length > HISTORY_PAGE };
}

export async function getSnapshotById(
  id: string,
): Promise<SocialMetricSnapshot | null> {
  const current = await getCurrentOrganization();
  if (!current) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("social_metric_snapshots")
    .select("*")
    .eq("organization_id", current.organization.id)
    .eq("id", id)
    .maybeSingle();
  return data ?? null;
}
