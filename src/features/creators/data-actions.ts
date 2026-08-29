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
import {
  getApplicationMetrics,
  getLatestEvidenceAt,
  getSnapshotHistoryPage,
  type ApplicationMetrics,
} from "@/features/evidence/queries";
import {
  getAddressTabData,
  type AddressTabData,
} from "@/features/requests/queries";
import type {
  CreatorAnalysis,
  CreatorEvent,
  SocialMetricSnapshot,
} from "@/types/database";

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
  /** Evidence Layer signal only — never a score input (§43). */
  evidence: { hasNewSnapshots: boolean };
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
      evidence: { hasNewSnapshots: false },
    };
  }
  const [timeline, current, history, latestEvidenceAt] = await Promise.all([
    getCreatorTimeline(detail.creator.id),
    getLatestCompletedAnalysis(applicationId),
    getAnalysisHistory(applicationId),
    getLatestEvidenceAt(detail.socials.map((s) => s.id)),
  ]);
  const hasNewSnapshots = Boolean(
    latestEvidenceAt &&
      current &&
      new Date(latestEvidenceAt).getTime() >
        new Date(current.created_at).getTime(),
  );
  return {
    detail,
    timeline,
    analysis: { aiConfigured, current, history },
    evidence: { hasNewSnapshots },
  };
}

/** Métricas tab — loaded on demand, never part of the CRM list (§40, §72). */
export async function loadMetricsForApplication(
  applicationId: string,
): Promise<ApplicationMetrics | null> {
  return getApplicationMetrics(applicationId);
}

/** "Endereço" tab — loaded on demand; never part of the CRM list (§99, §100). */
export async function loadAddressTab(
  applicationId: string,
  creatorId: string,
): Promise<AddressTabData> {
  return getAddressTabData(applicationId, creatorId);
}

/** "Carregar mais" in a profile's snapshot history (§73). */
export async function loadSnapshotHistoryPage(
  profileId: string,
  page: number,
): Promise<{ items: SocialMetricSnapshot[]; hasMore: boolean }> {
  return getSnapshotHistoryPage(profileId, Math.max(1, page));
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
