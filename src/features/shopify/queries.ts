import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import type {
  Commission,
  CommissionStatus,
  CreatorAffiliation,
  ShopifyOrder,
} from "@/types/database";

export interface ShopifyStatus {
  shop_domain: string;
  status: "connected" | "error";
  scopes: string | null;
  webhooks_ok: boolean;
  last_sync_at: string | null;
  last_error: string | null;
  connected_at: string;
}

export async function getShopifyStatus(orgId: string): Promise<ShopifyStatus | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("shopify_connection_status", { p_org: orgId });
  return (data as unknown as ShopifyStatus | null) ?? null;
}

/** The last sync is older than 6h (or never happened). */
export function isSyncStale(status: Pick<ShopifyStatus, "last_sync_at">, maxAgeMs = 6 * 3_600_000): boolean {
  return !status.last_sync_at || Date.now() - Date.parse(status.last_sync_at) > maxAgeMs;
}

export type OrderRow = ShopifyOrder & { creator_name: string | null };

/** Recent orders with the attributed creator's name. */
export async function getRecentOrders(limit = 50): Promise<OrderRow[]> {
  const current = await getCurrentOrganization();
  if (!current) return [];
  const supabase = await createClient();
  const orgId = current.organization.id;
  const { data: orders } = await supabase
    .from("shopify_orders")
    .select("*")
    .eq("organization_id", orgId)
    .order("processed_at", { ascending: false })
    .limit(limit);
  const list = (orders ?? []) as ShopifyOrder[];
  const names = await creatorNames(
    orgId,
    list.map((o) => o.creator_id).filter((x): x is string => Boolean(x)),
  );
  return list.map((o) => ({ ...o, creator_name: o.creator_id ? names.get(o.creator_id) ?? null : null }));
}

export async function getOrderStats(orgId: string, days = 60) {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data } = await supabase
    .from("shopify_orders")
    .select("subtotal, creator_id, cancelled_at, test")
    .eq("organization_id", orgId)
    .gte("processed_at", since)
    .limit(10000);
  const rows = (data ?? []).filter((r) => !r.test && !r.cancelled_at);
  const attributed = rows.filter((r) => r.creator_id);
  return {
    orders: rows.length,
    attributedOrders: attributed.length,
    attributedSales: attributed.reduce((s, r) => s + Number(r.subtotal), 0),
  };
}

async function creatorNames(orgId: string, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase
    .from("creators")
    .select("id, full_name, preferred_name")
    .eq("organization_id", orgId)
    .in("id", unique);
  return new Map((data ?? []).map((c) => [c.id, c.preferred_name || c.full_name]));
}

// ---------------------------------------------------------------------------
// Commissions
// ---------------------------------------------------------------------------
/** UI status: "pending" splits into "pending" (in hold) and "approved". */
export type CommissionUiStatus = Exclude<CommissionStatus, "pending"> | "pending" | "approved";

export function uiStatus(c: Pick<Commission, "status" | "approvable_at">, now = Date.now()): CommissionUiStatus {
  if (c.status === "pending" && Date.parse(c.approvable_at) <= now) return "approved";
  return c.status;
}

export interface CommissionRow extends Commission {
  ui_status: CommissionUiStatus;
  order_name: string | null;
  processed_at: string;
  creator_name: string;
  code: string | null;
}

export interface CreatorCommissionSummary {
  creator_id: string;
  creator_name: string;
  affiliation: CreatorAffiliation | null;
  orders: number;
  sales: number;
  pending: number;
  approved: number;
  paid: number;
}

export interface CommissionOverview {
  holdDays: number;
  totals: { pending: number; approved: number; paid: number; sales: number; orders: number };
  byCreator: CreatorCommissionSummary[];
  payable: CommissionRow[];
  recent: CommissionRow[];
}

export async function getCommissionOverview(): Promise<CommissionOverview | null> {
  const current = await getCurrentOrganization();
  if (!current) return null;
  const orgId = current.organization.id;
  const supabase = await createClient();

  const [{ data: commissions }, { data: affiliations }, { data: settings }] = await Promise.all([
    supabase
      .from("commissions")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase.from("creator_affiliations").select("*").eq("organization_id", orgId),
    supabase
      .from("organization_settings")
      .select("commission_hold_days")
      .eq("organization_id", orgId)
      .maybeSingle(),
  ]);

  const comms = (commissions ?? []) as Commission[];
  const affs = (affiliations ?? []) as CreatorAffiliation[];
  const orderIds = comms.map((c) => c.order_id);
  const orders = new Map<string, Pick<ShopifyOrder, "id" | "name" | "processed_at">>();
  for (let i = 0; i < orderIds.length; i += 500) {
    const { data } = await supabase
      .from("shopify_orders")
      .select("id, name, processed_at")
      .eq("organization_id", orgId)
      .in("id", orderIds.slice(i, i + 500));
    for (const o of data ?? []) orders.set(o.id, o);
  }
  const names = await creatorNames(orgId, [...comms.map((c) => c.creator_id), ...affs.map((a) => a.creator_id)]);
  const affByCreator = new Map(affs.map((a) => [a.creator_id, a]));

  const now = Date.now();
  const rows: CommissionRow[] = comms.map((c) => ({
    ...c,
    base_amount: Number(c.base_amount),
    amount: Number(c.amount),
    rate: Number(c.rate),
    ui_status: uiStatus(c, now),
    order_name: orders.get(c.order_id)?.name ?? null,
    processed_at: orders.get(c.order_id)?.processed_at ?? c.created_at,
    creator_name: names.get(c.creator_id) ?? "Creator removida",
    code: affByCreator.get(c.creator_id)?.code ?? null,
  }));

  const summary = new Map<string, CreatorCommissionSummary>();
  const ensure = (id: string) => {
    let s = summary.get(id);
    if (!s) {
      s = {
        creator_id: id,
        creator_name: names.get(id) ?? "Creator removida",
        affiliation: affByCreator.get(id) ?? null,
        orders: 0,
        sales: 0,
        pending: 0,
        approved: 0,
        paid: 0,
      };
      summary.set(id, s);
    }
    return s;
  };
  for (const a of affs) ensure(a.creator_id);
  const totals = { pending: 0, approved: 0, paid: 0, sales: 0, orders: 0 };
  for (const r of rows) {
    if (r.ui_status === "reversed" || r.ui_status === "awaiting_payment") continue;
    const s = ensure(r.creator_id);
    s.orders += 1;
    s.sales += r.base_amount;
    totals.orders += 1;
    totals.sales += r.base_amount;
    if (r.ui_status === "pending") {
      s.pending += r.amount;
      totals.pending += r.amount;
    } else if (r.ui_status === "approved") {
      s.approved += r.amount;
      totals.approved += r.amount;
    } else if (r.ui_status === "paid") {
      s.paid += r.amount;
      totals.paid += r.amount;
    }
  }

  return {
    holdDays: settings?.commission_hold_days ?? 30,
    totals,
    byCreator: [...summary.values()].sort((a, b) => b.sales - a.sales || a.creator_name.localeCompare(b.creator_name)),
    payable: rows.filter((r) => r.ui_status === "approved"),
    recent: rows.slice(0, 50),
  };
}

/** Creators that can receive an affiliate code (approved, not archived). */
export async function getAffiliableCreators(): Promise<{ id: string; name: string }[]> {
  const current = await getCurrentOrganization();
  if (!current) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("application_list_items")
    .select("creator_id, creator_name, creator_preferred_name, status")
    .eq("organization_id", current.organization.id)
    .eq("status", "approved")
    .limit(2000);
  const seen = new Map<string, string>();
  for (const r of data ?? []) {
    if (!seen.has(r.creator_id)) seen.set(r.creator_id, r.creator_preferred_name || r.creator_name);
  }
  return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
