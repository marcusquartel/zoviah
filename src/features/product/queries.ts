import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentOrganization } from "@/features/organizations/queries";
import type {
  FeatureRequestFrequency,
  FeatureRequestImportance,
  FeatureRequestStatus,
  RoadmapItemStatus,
} from "@/types/database";

export interface FeatureRequestBoardItem {
  id: string;
  title: string;
  problem: string;
  use_case: string | null;
  frequency: FeatureRequestFrequency;
  importance: FeatureRequestImportance;
  status: FeatureRequestStatus;
  created_at: string;
  is_own: boolean;
  vote_count: number;
  voted: boolean;
}

export async function listFeatureRequests(
  status?: string,
): Promise<FeatureRequestBoardItem[]> {
  if (!isSupabaseConfigured()) return [];
  const current = await getCurrentOrganization();
  if (!current) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_feature_requests", {
    p_organization_id: current.organization.id,
    p_status: status || null,
  });
  if (error || !Array.isArray(data)) return [];
  return data as unknown as FeatureRequestBoardItem[];
}

export interface RoadmapItemView {
  id: string;
  title: string;
  summary: string | null;
  status: RoadmapItemStatus;
  sort_order: number;
}

export const getRoadmap = cache(async (): Promise<RoadmapItemView[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_roadmap");
  if (error || !Array.isArray(data)) return [];
  return data as unknown as RoadmapItemView[];
});

export interface ChangelogView {
  id: string;
  title: string;
  summary: string | null;
  content: string;
  published_at: string | null;
  related_roadmap_item_id: string | null;
}

export const getChangelog = cache(
  async (limit = 30): Promise<ChangelogView[]> => {
    if (!isSupabaseConfigured()) return [];
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_changelog", {
      p_limit: limit,
    });
    if (error || !Array.isArray(data)) return [];
    return data as unknown as ChangelogView[];
  },
);
