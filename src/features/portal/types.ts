/** Shapes returned by the portal RPCs (see 20261022000007_creator_portal.sql). */

export interface PortalCreatorRef {
  creator_id: string;
  creator_name: string;
  organization_name: string;
}

export interface PortalRankingRow {
  position: number;
  name: string;
  tier: string | null;
  me: boolean;
  /** Sold at least once this month (no value revealed). */
  active: boolean;
  /** Only present on the caller's own row. */
  sales: number | null;
  orders: number | null;
}

export type PortalCommissionStatus =
  | "awaiting_payment"
  | "in_hold"
  | "available"
  | "paid"
  | "reversed";

export interface PortalDashboard {
  creator: { name: string; full_name: string; avatar_url: string | null };
  organization: { name: string };
  branding: { primary_color: string | null; secondary_color: string | null; logo_url: string | null };
  /** Consecutive months with at least one paid sale (this or last month back). */
  streak_months: number;
  totals: { orders: number; sales: number };
  tier: { name: string; commission_rate: number; description: string | null } | null;
  commission_rate: number | null;
  coupons: {
    affiliate: { code: string; discount_percent: number | null; active: boolean } | null;
    personal: { code: string; discount_percent: number | null } | null;
  };
  month: { from: string; orders: number; sales: number; commission: number };
  commissions: { awaiting_payment: number; in_hold: number; available: number; paid: number };
  recent_orders: {
    name: string | null;
    processed_at: string;
    subtotal: number;
    currency: string;
    cancelled: boolean;
    commission: number | null;
    commission_status: PortalCommissionStatus | null;
  }[];
  ranking: { all: PortalRankingRow[]; tier: PortalRankingRow[] | null };
}
