"use server";

import { parseCreatorQuery } from "@/lib/query-state";
import {
  getApplicationDetail,
  getCreatorTimeline,
  listApplicationItems,
  type ApplicationDetail,
  type ApplicationListPage,
} from "@/features/creators/queries";
import {
  getAnalysisById,
  getAnalysisHistory,
  getLatestCompletedAnalysis,
  type AnalysisHistoryItem,
} from "@/features/analysis/queries";
import { isAnthropicConfigured } from "@/lib/anthropic/env";
import type { CreatorAnalysis, CreatorEvent } from "@/types/database";

/** Next page of the CRM list (client "load more"). */
export async function loadMoreApplications(
  search: string,
  page: number,
): Promise<ApplicationListPage> {
  const query = parseCreatorQuery(new URLSearchParams(search));
  return listApplicationItems({ ...query, page: Math.max(1, page) });
}

export interface DrawerAnalysis {
  aiConfigured: boolean;
  current: CreatorAnalysis | null;
  history: AnalysisHistoryItem[];
}

export interface DrawerData {
  detail: ApplicationDetail | null;
  timeline: CreatorEvent[];
  analysis: DrawerAnalysis;
}

/** Everything the Creator drawer needs, fetched on open. */
export async function loadDrawerData(
  applicationId: string,
): Promise<DrawerData> {
  const detail = await getApplicationDetail(applicationId);
  const aiConfigured = isAnthropicConfigured();
  if (!detail) {
    return {
      detail: null,
      timeline: [],
      analysis: { aiConfigured, current: null, history: [] },
    };
  }
  const [timeline, current, history] = await Promise.all([
    getCreatorTimeline(detail.creator.id),
    getLatestCompletedAnalysis(applicationId),
    getAnalysisHistory(applicationId),
  ]);
  return { detail, timeline, analysis: { aiConfigured, current, history } };
}

/** A single historical analysis snapshot (for the drawer history view). */
export async function loadAnalysisSnapshot(
  analysisId: string,
): Promise<CreatorAnalysis | null> {
  return getAnalysisById(analysisId);
}

/** Refresh just the timeline (after adding a note / changing status). */
export async function reloadTimeline(
  creatorId: string,
): Promise<CreatorEvent[]> {
  return getCreatorTimeline(creatorId);
}
