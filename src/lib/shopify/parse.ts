/**
 * Pure Shopify helpers: shop-domain and affiliate-code normalization, webhook
 * HMAC verification, UTM extraction and the order → ingest-row mapping. No
 * I/O, so all of it is unit-testable. Relative imports only.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
export { normalizeAffiliateCode, suggestAffiliateCode } from "./codes.ts";

export const SHOPIFY_API_VERSION = "2026-10";

/** "minha-loja", "minha-loja.myshopify.com", "https://minha-loja.myshopify.com/admin" → "minha-loja.myshopify.com". */
export function normalizeShopDomain(input: string): string | null {
  let s = (input ?? "").trim().toLowerCase();
  s = s.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!s) return null;
  if (!s.includes(".")) s = `${s}.myshopify.com`;
  return /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s) ? s : null;
}

/** Shopify webhook HMAC: base64(HMAC-SHA256(client secret, raw body)). */
export function verifyWebhookHmac(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  let given: Buffer;
  try {
    given = Buffer.from(header, "base64");
  } catch {
    return false;
  }
  return given.length === digest.length && timingSafeEqual(given, digest);
}

export interface Utm {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  content?: string | null;
  term?: string | null;
}

/** UTM from a journey visit: the structured block, else the landing page query string. */
export function utmFromVisit(
  visit: { utmParameters?: Utm | null; landingPage?: string | null } | null | undefined,
): Utm | null {
  if (!visit) return null;
  const u = visit.utmParameters ?? null;
  if (u && (u.campaign || u.content || u.source || u.medium || u.term)) {
    return clean(u);
  }
  if (visit.landingPage) {
    try {
      const url = new URL(visit.landingPage, "https://placeholder.local");
      const q = url.searchParams;
      const fromUrl = {
        source: q.get("utm_source"),
        medium: q.get("utm_medium"),
        campaign: q.get("utm_campaign"),
        content: q.get("utm_content"),
        term: q.get("utm_term"),
      };
      if (Object.values(fromUrl).some(Boolean)) return clean(fromUrl);
    } catch {
      /* not a URL */
    }
  }
  return null;
}

function clean(u: Utm): Utm {
  const out: Utm = {};
  for (const k of ["source", "medium", "campaign", "content", "term"] as const) {
    const v = u[k];
    if (typeof v === "string" && v.trim()) out[k] = v.trim().slice(0, 150);
  }
  return out;
}

/** The subset of a GraphQL Order this app reads. */
export interface ShopifyOrderNode {
  id: string;
  name?: string | null;
  processedAt?: string | null;
  createdAt?: string | null;
  cancelledAt?: string | null;
  displayFinancialStatus?: string | null;
  test?: boolean | null;
  currencyCode?: string | null;
  discountCodes?: string[] | null;
  currentSubtotalPriceSet?: { shopMoney?: { amount?: string | null } | null } | null;
  totalDiscountsSet?: { shopMoney?: { amount?: string | null } | null } | null;
  totalRefundedSet?: { shopMoney?: { amount?: string | null } | null } | null;
  customerJourneySummary?: {
    firstVisit?: { utmParameters?: Utm | null; landingPage?: string | null } | null;
    lastVisit?: { utmParameters?: Utm | null; landingPage?: string | null } | null;
  } | null;
}

export interface IngestOrder {
  id: string;
  name: string | null;
  processed_at: string;
  cancelled_at: string | null;
  financial_status: string | null;
  currency: string;
  subtotal: number;
  total_discounts: number;
  total_refunded: number;
  discount_codes: string[];
  utm_last: Utm | null;
  utm_first: Utm | null;
  test: boolean;
}

const money = (m?: { shopMoney?: { amount?: string | null } | null } | null) => {
  const n = Number(m?.shopMoney?.amount ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function toIngestOrder(o: ShopifyOrderNode): IngestOrder {
  const journey = o.customerJourneySummary ?? null;
  return {
    id: o.id,
    name: o.name ?? null,
    processed_at: o.processedAt ?? o.createdAt ?? new Date().toISOString(),
    cancelled_at: o.cancelledAt ?? null,
    financial_status: o.displayFinancialStatus ?? null,
    currency: o.currencyCode ?? "BRL",
    subtotal: money(o.currentSubtotalPriceSet),
    total_discounts: money(o.totalDiscountsSet),
    total_refunded: money(o.totalRefundedSet),
    discount_codes: (o.discountCodes ?? []).filter((c) => typeof c === "string" && c.trim()),
    utm_last: journey ? utmFromVisit(journey.lastVisit) : null,
    utm_first: journey ? utmFromVisit(journey.firstVisit) : null,
    test: Boolean(o.test),
  };
}

/**
 * Attribution mirror of the SQL `attribute_shopify_order` (used for previews
 * and tests): coupon first, then last-visit UTM, then first-visit UTM.
 */
export function attribute(
  order: Pick<IngestOrder, "discount_codes" | "utm_last" | "utm_first">,
  codes: { creatorId: string; code: string }[],
): { creatorId: string; source: "coupon" | "utm_last" | "utm_first" } | null {
  const up = (s?: string | null) => (s ?? "").trim().toUpperCase();
  const byCode = new Map(codes.map((c) => [c.code.toUpperCase(), c.creatorId]));
  for (const d of order.discount_codes) {
    const hit = byCode.get(up(d));
    if (hit) return { creatorId: hit, source: "coupon" };
  }
  for (const [utm, source] of [
    [order.utm_last, "utm_last"],
    [order.utm_first, "utm_first"],
  ] as const) {
    for (const v of [utm?.campaign, utm?.content]) {
      const hit = byCode.get(up(v));
      if (hit) return { creatorId: hit, source };
    }
  }
  return null;
}
