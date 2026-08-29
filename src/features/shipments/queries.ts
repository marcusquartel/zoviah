import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import {
  serializeShipmentQuery,
  type ShipmentQuery,
} from "@/lib/shipment-query";
import type {
  AddressSnapshot,
  Shipment,
  ShipmentItem,
  ShipmentListItem,
  ShipmentStatus,
} from "@/types/database";

const PAGE_SIZE = 50;

export interface ShipmentCounts {
  open: number;
  draft: number;
  preparing: number;
  shipped: number;
  delivered: number;
  cancelled: number;
}

const EMPTY_COUNTS: ShipmentCounts = {
  open: 0,
  draft: 0,
  preparing: 0,
  shipped: 0,
  delivered: 0,
  cancelled: 0,
};

export async function getShipmentCounts(
  programId?: string | null,
): Promise<ShipmentCounts> {
  const current = await getCurrentOrganization();
  if (!current) return EMPTY_COUNTS;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("shipment_counts", {
    p_program_id: programId ?? undefined,
  });
  if (error || !data) return EMPTY_COUNTS;
  return { ...EMPTY_COUNTS, ...(data as Partial<ShipmentCounts>) };
}

export interface ShipmentListPage {
  items: ShipmentListItem[];
  hasMore: boolean;
  page: number;
}

function sanitizeSearch(q: string): string {
  return q.replace(/[,()*:%\\]/g, " ").trim().slice(0, 80);
}

/** One query against `shipment_list_items` — no N+1, no address_snapshot. */
export async function listShipments(
  query: ShipmentQuery,
  options: { pageSize?: number } = {},
): Promise<ShipmentListPage> {
  const pageSize = options.pageSize ?? PAGE_SIZE;
  const current = await getCurrentOrganization();
  if (!current) return { items: [], hasMore: false, page: 1 };

  const supabase = await createClient();
  let q = supabase
    .from("shipment_list_items")
    .select("*")
    .eq("organization_id", current.organization.id);

  if (query.status) q = q.eq("status", query.status);
  if (query.program) q = q.eq("program_id", query.program);
  if (query.carrier) q = q.ilike("carrier", `%${query.carrier}%`);
  if (query.createdFrom) q = q.gte("created_at", query.createdFrom);

  const term = sanitizeSearch(query.q);
  if (term) {
    q = q.or(
      [
        `creator_name.ilike.*${term}*`,
        `creator_email.ilike.*${term}*`,
        `tracking_code.ilike.*${term}*`,
      ].join(","),
    );
  }

  switch (query.sort) {
    case "oldest":
      q = q.order("created_at", { ascending: true });
      break;
    case "shipped_recent":
      q = q.order("shipped_at", { ascending: false, nullsFirst: false });
      break;
    case "creator_asc":
      q = q.order("creator_name", { ascending: true });
      break;
    default:
      q = q.order("created_at", { ascending: false });
  }
  q = q.order("id", { ascending: false });

  const from = (query.page - 1) * pageSize;
  q = q.range(from, from + pageSize);

  const { data, error } = await q;
  if (error || !data) return { items: [], hasMore: false, page: query.page };
  return {
    items: data.slice(0, pageSize),
    hasMore: data.length > pageSize,
    page: query.page,
  };
}

export interface ShipmentDetail {
  shipment: Shipment;
  items: ShipmentItem[];
  creator: { id: string; full_name: string };
  program: { id: string; name: string };
  application: { id: string; status: string };
  /** Current address id of the creator — for the stale-address hint (§68). */
  currentAddressId: string | null;
}

/** Full detail incl. address_snapshot — loaded ONLY on modal open (§99). */
export const getShipmentDetail = cache(
  async (shipmentId: string): Promise<ShipmentDetail | null> => {
    const current = await getCurrentOrganization();
    if (!current) return null;
    const orgId = current.organization.id;
    const supabase = await createClient();

    const { data: shipment, error } = await supabase
      .from("shipments")
      .select("*, creators(id, full_name), applications(id, status, program_id)")
      .eq("organization_id", orgId)
      .eq("id", shipmentId)
      .maybeSingle();
    if (error || !shipment || !shipment.creators || !shipment.applications) {
      return null;
    }

    const { creators, applications, ...rest } = shipment;
    const [{ data: items }, { data: program }, { data: addr }] =
      await Promise.all([
        supabase
          .from("shipment_items")
          .select("*")
          .eq("shipment_id", shipmentId)
          .order("position", { ascending: true }),
        supabase
          .from("programs")
          .select("id, name")
          .eq("id", applications.program_id)
          .maybeSingle(),
        supabase
          .from("creator_addresses")
          .select("id")
          .eq("organization_id", orgId)
          .eq("creator_id", creators.id)
          .eq("is_current", true)
          .maybeSingle(),
      ]);

    return {
      shipment: rest as Shipment,
      items: items ?? [],
      creator: creators,
      program: program ?? { id: applications.program_id, name: "—" },
      application: { id: applications.id, status: applications.status },
      currentAddressId: addr?.id ?? null,
    };
  },
);

export interface CreatorShipment {
  id: string;
  status: ShipmentStatus;
  item_count: number;
  first_item_name: string | null;
  created_at: string;
  shipped_at: string | null;
  delivered_at: string | null;
}

/** Shipments of one application — light, for the creator modal "Envios" tab. */
export async function getShipmentsForApplication(
  applicationId: string,
): Promise<CreatorShipment[]> {
  const current = await getCurrentOrganization();
  if (!current) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("shipment_list_items")
    .select(
      "id, status, item_count, first_item_name, created_at, shipped_at, delivered_at",
    )
    .eq("organization_id", current.organization.id)
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  return (data ?? []) as CreatorShipment[];
}

export type { AddressSnapshot };
export { serializeShipmentQuery };
