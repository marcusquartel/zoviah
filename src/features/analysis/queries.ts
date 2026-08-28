import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import type { CreatorAnalysis } from "@/types/database";

export type AnalysisHistoryItem = Pick<
  CreatorAnalysis,
  | "id"
  | "created_at"
  | "status"
  | "score"
  | "tier"
  | "confidence"
  | "evidence_coverage"
  | "model"
  | "prompt_version"
  | "scoring_version"
>;

const HISTORY_COLUMNS =
  "id, created_at, status, score, tier, confidence, evidence_coverage, model, prompt_version, scoring_version";

/** Latest COMPLETED analysis for an application (what the drawer renders). */
export const getLatestCompletedAnalysis = cache(
  async (applicationId: string): Promise<CreatorAnalysis | null> => {
    const current = await getCurrentOrganization();
    if (!current) return null;
    const supabase = await createClient();
    const { data } = await supabase
      .from("creator_analyses")
      .select("*")
      .eq("organization_id", current.organization.id)
      .eq("application_id", applicationId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  },
);

export async function getAnalysisHistory(
  applicationId: string,
  limit = 20,
): Promise<AnalysisHistoryItem[]> {
  const current = await getCurrentOrganization();
  if (!current) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("creator_analyses")
    .select(HISTORY_COLUMNS)
    .eq("organization_id", current.organization.id)
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AnalysisHistoryItem[];
}

export async function getAnalysisById(
  analysisId: string,
): Promise<CreatorAnalysis | null> {
  const current = await getCurrentOrganization();
  if (!current) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("creator_analyses")
    .select("*")
    .eq("organization_id", current.organization.id)
    .eq("id", analysisId)
    .maybeSingle();
  return data ?? null;
}

export interface AnalysisStats {
  completed: number;
  failed: number;
  processing: number;
  avg_score: number | null;
  avg_coverage: number | null;
}

export async function getAnalysisStats(): Promise<AnalysisStats> {
  const empty: AnalysisStats = {
    completed: 0,
    failed: 0,
    processing: 0,
    avg_score: null,
    avg_coverage: null,
  };
  const current = await getCurrentOrganization();
  if (!current) return empty;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("analysis_stats");
  if (error || !data) return empty;
  return { ...empty, ...(data as Partial<AnalysisStats>) };
}
