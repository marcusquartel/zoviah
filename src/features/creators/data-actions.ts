"use server";

import { parseCreatorQuery } from "@/lib/query-state";
import {
  getApplicationDetail,
  getCreatorTimeline,
  listApplicationItems,
  type ApplicationDetail,
  type ApplicationListPage,
} from "@/features/creators/queries";
import type { CreatorEvent } from "@/types/database";

/** Next page of the CRM list (client "load more"). */
export async function loadMoreApplications(
  search: string,
  page: number,
): Promise<ApplicationListPage> {
  const query = parseCreatorQuery(new URLSearchParams(search));
  return listApplicationItems({ ...query, page: Math.max(1, page) });
}

export interface DrawerData {
  detail: ApplicationDetail | null;
  timeline: CreatorEvent[];
}

/** Everything the Creator drawer needs, fetched on open. */
export async function loadDrawerData(
  applicationId: string,
): Promise<DrawerData> {
  const detail = await getApplicationDetail(applicationId);
  if (!detail) return { detail: null, timeline: [] };
  const timeline = await getCreatorTimeline(detail.creator.id);
  return { detail, timeline };
}

/** Refresh just the timeline (after adding a note / changing status). */
export async function reloadTimeline(
  creatorId: string,
): Promise<CreatorEvent[]> {
  return getCreatorTimeline(creatorId);
}
