import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  ChangelogEntry,
  FeatureRequestFrequency,
  FeatureRequestImportance,
  FeatureRequestStatus,
  RoadmapItem,
} from "@/types/database";

export interface AdminFeatureRequestRow {
  id: string;
  title: string;
  problem: string;
  use_case: string | null;
  frequency: FeatureRequestFrequency;
  importance: FeatureRequestImportance;
  status: FeatureRequestStatus;
  admin_note: string | null;
  canonical_request_id: string | null;
  created_at: string;
  organization_name: string;
  vote_count: number;
}

export async function listFeatureRequestsAdmin(
  status?: string,
): Promise<AdminFeatureRequestRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_feature_requests", {
    p_status: status || null,
  });
  if (error || !Array.isArray(data)) return [];
  return data as unknown as AdminFeatureRequestRow[];
}

export const listRoadmapItemsAdmin = cache(
  async (): Promise<RoadmapItem[]> => {
    if (!isSupabaseConfigured()) return [];
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_list_roadmap_items");
    if (error || !Array.isArray(data)) return [];
    return data as unknown as RoadmapItem[];
  },
);

export const listChangelogEntriesAdmin = cache(
  async (): Promise<ChangelogEntry[]> => {
    if (!isSupabaseConfigured()) return [];
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_list_changelog_entries");
    if (error || !Array.isArray(data)) return [];
    return data as unknown as ChangelogEntry[];
  },
);
