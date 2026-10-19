import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";

process.env.SHOPIFY_ENC_KEY ??= randomBytes(32).toString("base64");

const { seal, open, ingestKey, sha256Hex } = await import("../src/lib/crypto/secret-box.ts");
const {
  normalizeShopDomain,
  normalizeAffiliateCode,
  suggestAffiliateCode,
  verifyWebhookHmac,
  utmFromVisit,
  toIngestOrder,
  attribute,
} = await import("../src/lib/shopify/parse.ts");

test("secret box: round trip, random IV, tamper is rejected", () => {
  const a = seal("shpss_secret");
  const b = seal("shpss_secret");
  assert.notEqual(a, b, "each seal uses a fresh IV");
  assert.equal(open(a), "shpss_secret");
  const parts = a.split(".");
  parts[3] = Buffer.from("tampered").toString("base64url");
  assert.throws(() => open(parts.join(".")));
  assert.throws(() => open("not-a-ciphertext"));
});

test("ingest key: deterministic per org, 64 hex, differs across orgs", () => {
  const k1 = ingestKey("11111111-1111-1111-1111-111111111111");
  assert.match(k1, /^[0-9a-f]{64}$/);
  assert.equal(k1, ingestKey("11111111-1111-1111-1111-111111111111"));
  assert.notEqual(k1, ingestKey("22222222-2222-2222-2222-222222222222"));
  assert.match(sha256Hex(k1), /^[0-9a-f]{64}$/);
});

test("normalizeShopDomain accepts handle, domain and admin URL", () => {
  assert.equal(normalizeShopDomain("rare-way"), "rare-way.myshopify.com");
  assert.equal(normalizeShopDomain(" Rare-Way.myshopify.com "), "rare-way.myshopify.com");
  assert.equal(normalizeShopDomain("https://rare-way.myshopify.com/admin/orders"), "rare-way.myshopify.com");
  assert.equal(normalizeShopDomain("rareway.com.br"), null);
  assert.equal(normalizeShopDomain(""), null);
});

test("affiliate codes: normalized uppercase, accents stripped, length bounds", () => {
  assert.equal(normalizeAffiliateCode("mariana 10"), "MARIANA10");
  assert.equal(normalizeAffiliateCode("joão_s"), "JOAO_S");
  assert.equal(normalizeAffiliateCode("ab"), null);
  assert.equal(normalizeAffiliateCode("x".repeat(41)), null);
  assert.equal(suggestAffiliateCode("Mariana Souza"), "MARIANA");
  assert.equal(suggestAffiliateCode("Bo"), "BO10");
});

test("webhook HMAC: valid signature passes, wrong secret / body fails", () => {
  const body = JSON.stringify({ id: 1 });
  const sig = createHmac("sha256", "secret").update(body).digest("base64");
  assert.equal(verifyWebhookHmac(body, sig, "secret"), true);
  assert.equal(verifyWebhookHmac(body, sig, "other"), false);
  assert.equal(verifyWebhookHmac(body + " ", sig, "secret"), false);
  assert.equal(verifyWebhookHmac(body, null, "secret"), false);
});

test("utmFromVisit: structured block first, landing page as fallback", () => {
  assert.deepEqual(
    utmFromVisit({ utmParameters: { campaign: "MARIANA", source: "instagram" } }),
    { campaign: "MARIANA", source: "instagram" },
  );
  assert.deepEqual(
    utmFromVisit({ utmParameters: null, landingPage: "/products/x?utm_campaign=ANA&utm_source=ig" }),
    { campaign: "ANA", source: "ig" },
  );
  assert.equal(utmFromVisit({ landingPage: "/products/x" }), null);
  assert.equal(utmFromVisit(null), null);
});

test("toIngestOrder maps money, codes, journey and status", () => {
  const row = toIngestOrder({
    id: "gid://shopify/Order/1",
    name: "#1001",
    processedAt: "2026-10-01T12:00:00Z",
    displayFinancialStatus: "PAID",
    currencyCode: "BRL",
    discountCodes: ["MARIANA", ""],
    currentSubtotalPriceSet: { shopMoney: { amount: "189.90" } },
    totalDiscountsSet: { shopMoney: { amount: "21.10" } },
    totalRefundedSet: { shopMoney: { amount: "0.00" } },
    customerJourneySummary: {
      lastVisit: { utmParameters: { campaign: "ANA" } },
      firstVisit: null,
    },
  });
  assert.equal(row.subtotal, 189.9);
  assert.equal(row.total_discounts, 21.1);
  assert.deepEqual(row.discount_codes, ["MARIANA"]);
  assert.deepEqual(row.utm_last, { campaign: "ANA" });
  assert.equal(row.utm_first, null);
  assert.equal(row.financial_status, "PAID");
  assert.equal(row.test, false);
});

test("attribute: coupon beats UTM; last visit beats first; case-insensitive", () => {
  const codes = [
    { creatorId: "c-mariana", code: "MARIANA" },
    { creatorId: "c-ana", code: "ANA" },
  ];
  assert.deepEqual(
    attribute({ discount_codes: ["mariana"], utm_last: { campaign: "ANA" }, utm_first: null }, codes),
    { creatorId: "c-mariana", source: "coupon" },
  );
  assert.deepEqual(
    attribute({ discount_codes: ["OUTRO"], utm_last: { content: "ana" }, utm_first: { campaign: "MARIANA" } }, codes),
    { creatorId: "c-ana", source: "utm_last" },
  );
  assert.deepEqual(
    attribute({ discount_codes: [], utm_last: null, utm_first: { campaign: "Mariana" } }, codes),
    { creatorId: "c-mariana", source: "utm_first" },
  );
  assert.equal(attribute({ discount_codes: [], utm_last: null, utm_first: null }, codes), null);
});
