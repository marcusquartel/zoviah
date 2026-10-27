"use server";

import { parseCreatorQuery } from "@/lib/query-state";
import type { PublicFieldDef } from "@/lib/form-fields";
import {
  getApplicationDetail,
  getCreatorFormFields,
  getCreatorTimeline,
  listApplicationItems,
  type ApplicationDetail,
  type ApplicationListPage,
  type CreatorFormProgram,
} from "@/features/creators/queries";
import {
  getApplicationMetrics,
  getSnapshotHistoryPage,
  type ApplicationMetrics,
} from "@/features/evidence/queries";
import {
  getAddressTabData,
  type AddressTabData,
} from "@/features/requests/queries";
import {
  getShipmentsForApplication,
  type CreatorShipment,
} from "@/features/shipments/queries";
import { createClient } from "@/lib/supabase/server";
import { getTiers, type TierWithCount } from "@/features/tiers/queries";
import { listOrgContent, type StaffContentRow } from "@/features/content/queries";
import { getCurrentOrganization } from "@/features/organizations/queries";
import type {
  CreatorAffiliation,
  CreatorEvent,
  CreatorPersonalCoupon,
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

/** A program's active form fields, for the "Adicionar creator" dialog. */
export async function loadCreatorFormFields(
  programId: string,
): Promise<{ program: CreatorFormProgram | null; fields: PublicFieldDef[] }> {
  return getCreatorFormFields(programId);
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

export interface ShipmentsTabData {
  shipments: CreatorShipment[];
  hasCurrentAddress: boolean;
}

/** "Envios" tab — loaded on demand. `hasCurrentAddress` gates "Novo envio". */
export async function loadShipmentsTab(
  applicationId: string,
  creatorId: string,
): Promise<ShipmentsTabData> {
  const current = await getCurrentOrganization();
  if (!current) return { shipments: [], hasCurrentAddress: false };
  const supabase = await createClient();
  const [shipments, { data: addr }] = await Promise.all([
    getShipmentsForApplication(applicationId),
    supabase
      .from("creator_addresses")
      .select("id")
      .eq("organization_id", current.organization.id)
      .eq("creator_id", creatorId)
      .eq("is_current", true)
      .maybeSingle(),
  ]);
  return { shipments, hasCurrentAddress: Boolean(addr?.id) };
}

/** "Carregar mais" in a profile's snapshot history (§73). */
export async function loadSnapshotHistoryPage(
  profileId: string,
  page: number,
): Promise<{ items: SocialMetricSnapshot[]; hasMore: boolean }> {
  return getSnapshotHistoryPage(profileId, Math.max(1, page));
}

/** Refresh just the timeline (after adding a note / changing status). */
export async function reloadTimeline(
  creatorId: string,
): Promise<CreatorEvent[]> {
  return getCreatorTimeline(creatorId);
}

export interface CouponsTabData {
  affiliation: CreatorAffiliation | null;
  personal: CreatorPersonalCoupon | null;
  tiers: TierWithCount[];
  tierId: string | null;
  notifySales: boolean;
  portal: {
    active: boolean;
    /** Access was removed by staff (the automatic link is blocked). */
    disabled: boolean;
    since: string | null;
    invite: { status: string; created_at: string; expires_at: string } | null;
  };
}

/** "Cupons" tab — the affiliate (commissioned) and the personal coupon. */
export async function loadCouponsTab(creatorId: string): Promise<CouponsTabData> {
  const current = await getCurrentOrganization();
  if (!current) {
    return {
      affiliation: null,
      personal: null,
      tiers: [],
      tierId: null,
      notifySales: true,
      portal: { active: false, disabled: false, since: null, invite: null },
    };
  }
  const supabase = await createClient();
  const orgId = current.organization.id;
  const [
    { data: affiliation },
    { data: personal },
    tiers,
    { data: creator },
    { data: portalUser },
    { data: invite },
  ] = await Promise.all([
    supabase
      .from("creator_affiliations")
      .select("*")
      .eq("organization_id", orgId)
      .eq("creator_id", creatorId)
      .maybeSingle(),
    supabase
      .from("creator_personal_coupons")
      .select("*")
      .eq("organization_id", orgId)
      .eq("creator_id", creatorId)
      .maybeSingle(),
    getTiers(orgId),
    supabase
      .from("creators")
      .select("tier_id, notify_sales, portal_disabled")
      .eq("organization_id", orgId)
      .eq("id", creatorId)
      .maybeSingle(),
    supabase
      .from("creator_portal_users")
      .select("created_at")
      .eq("organization_id", orgId)
      .eq("creator_id", creatorId)
      .maybeSingle(),
    supabase
      .from("creator_portal_invites")
      .select("status, created_at, expires_at")
      .eq("organization_id", orgId)
      .eq("creator_id", creatorId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    affiliation: affiliation ?? null,
    personal: personal ?? null,
    tiers,
    tierId: creator?.tier_id ?? null,
    notifySales: creator?.notify_sales ?? true,
    portal: {
      active: Boolean(portalUser),
      disabled: creator?.portal_disabled ?? false,
      since: portalUser?.created_at ?? null,
      // An expired invite reads as "no invite" (the RPCs expire it lazily).
      invite:
        invite && !(invite.status === "pending" && Date.parse(invite.expires_at) <= Date.now())
          ? invite
          : null,
    },
  };
}

/** "Conteúdos" tab — this creator's registered publications. */
export async function loadCreatorContent(creatorId: string): Promise<StaffContentRow[]> {
  const current = await getCurrentOrganization();
  if (!current) return [];
  return listOrgContent(current.organization.id, { creatorId, limit: 100 });
}
