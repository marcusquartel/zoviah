import { test } from "node:test";
import assert from "node:assert/strict";
import {
  shipmentItemSchema,
  shipmentItemsSchema,
  trackingSchema,
  toItemsPayload,
} from "../src/lib/validation/shipment.ts";

const okItem = { itemName: "  Glance Brow Lift  ", sku: "", quantity: "2" };

test("item: name trimmed 1..200, quantity coerced int 1..999", () => {
  const r = shipmentItemSchema.parse(okItem);
  assert.equal(r.itemName, "Glance Brow Lift");
  assert.equal(r.quantity, 2);
  assert.equal(r.sku, "");
});

test("item: rejects blank name, non-int / out-of-range quantity, long sku", () => {
  assert.equal(shipmentItemSchema.safeParse({ ...okItem, itemName: "   " }).success, false);
  assert.equal(shipmentItemSchema.safeParse({ ...okItem, itemName: "x".repeat(201) }).success, false);
  assert.equal(shipmentItemSchema.safeParse({ ...okItem, quantity: "0" }).success, false);
  assert.equal(shipmentItemSchema.safeParse({ ...okItem, quantity: "1000" }).success, false);
  assert.equal(shipmentItemSchema.safeParse({ ...okItem, quantity: "2.5" }).success, false);
  assert.equal(shipmentItemSchema.safeParse({ ...okItem, sku: "s".repeat(101) }).success, false);
});

test("items array: 1..50", () => {
  assert.equal(shipmentItemsSchema.safeParse([]).success, false);
  assert.equal(shipmentItemsSchema.safeParse([okItem]).success, true);
  assert.equal(
    shipmentItemsSchema.safeParse(Array.from({ length: 51 }, () => okItem)).success,
    false,
  );
});

test("toItemsPayload: snake_case, null sku when empty", () => {
  const p = toItemsPayload(shipmentItemsSchema.parse([okItem, { ...okItem, sku: "SKU-1" }]));
  assert.deepEqual(p, [
    { item_name: "Glance Brow Lift", sku: null, quantity: 2 },
    { item_name: "Glance Brow Lift", sku: "SKU-1", quantity: 2 },
  ]);
});

test("tracking: carrier/code optional; notes <= 2000", () => {
  const r = trackingSchema.parse({});
  assert.deepEqual(r, {
    carrier: "",
    trackingCode: "",
    trackingUrl: "",
    internalNotes: "",
  });
  assert.equal(
    trackingSchema.safeParse({ internalNotes: "n".repeat(2001) }).success,
    false,
  );
});

test("tracking URL: http(s) only — javascript: / data: / relative rejected", () => {
  assert.equal(trackingSchema.safeParse({ trackingUrl: "https://correios.com.br/x" }).success, true);
  assert.equal(trackingSchema.safeParse({ trackingUrl: "http://t.co/x" }).success, true);
  assert.equal(trackingSchema.safeParse({ trackingUrl: "" }).success, true);
  assert.equal(trackingSchema.safeParse({ trackingUrl: "javascript:alert(1)" }).success, false);
  assert.equal(trackingSchema.safeParse({ trackingUrl: "data:text/html,x" }).success, false);
  assert.equal(trackingSchema.safeParse({ trackingUrl: "/rastreio/123" }).success, false);
  assert.equal(trackingSchema.safeParse({ trackingUrl: "ftp://x.com" }).success, false);
});
