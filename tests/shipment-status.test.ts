import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_TRANSITIONS,
  canTransitionShipment,
  nextShipmentStatuses,
  shipmentActionLabel,
  isShipmentAddressStale,
} from "../src/features/shipments/status.ts";
import type { ShipmentStatus } from "../src/types/database.ts";

// Must match is_valid_shipment_transition() in migration 20260829000004.
const EXPECTED: [ShipmentStatus, ShipmentStatus][] = [
  ["draft", "preparing"],
  ["draft", "cancelled"],
  ["preparing", "draft"],
  ["preparing", "shipped"],
  ["preparing", "cancelled"],
  ["shipped", "delivered"],
  ["shipped", "preparing"],
  ["delivered", "shipped"],
  ["cancelled", "draft"],
];

test("every spec transition is valid; nothing else is", () => {
  const allowed = new Set(EXPECTED.map(([f, t]) => `${f}>${t}`));
  for (const from of SHIPMENT_STATUSES) {
    for (const to of SHIPMENT_STATUSES) {
      assert.equal(
        canTransitionShipment(from, to),
        allowed.has(`${from}>${to}`),
        `${from} -> ${to}`,
      );
    }
  }
});

test("nextShipmentStatuses matches SHIPMENT_TRANSITIONS", () => {
  for (const from of SHIPMENT_STATUSES) {
    assert.deepEqual(nextShipmentStatuses(from), SHIPMENT_TRANSITIONS[from]);
  }
  assert.deepEqual(nextShipmentStatuses("delivered"), ["shipped"]);
});

test("specific invalid transitions are rejected", () => {
  assert.equal(canTransitionShipment("draft", "shipped"), false);
  assert.equal(canTransitionShipment("draft", "delivered"), false);
  assert.equal(canTransitionShipment("delivered", "cancelled"), false);
  assert.equal(canTransitionShipment("cancelled", "shipped"), false);
  assert.equal(canTransitionShipment("shipped", "draft"), false);
});

test("labels exist for every status", () => {
  for (const s of SHIPMENT_STATUSES) {
    assert.equal(typeof SHIPMENT_STATUS_LABELS[s], "string");
  }
});

test("action labels are human", () => {
  assert.equal(shipmentActionLabel("draft", "preparing"), "Começar preparação");
  assert.equal(shipmentActionLabel("preparing", "shipped"), "Marcar enviado");
  assert.equal(shipmentActionLabel("shipped", "delivered"), "Marcar entregue");
  assert.equal(shipmentActionLabel("preparing", "cancelled"), "Cancelar");
  assert.equal(shipmentActionLabel("cancelled", "draft"), "Restaurar");
});

test("isShipmentAddressStale: current differs from the shipment source", () => {
  assert.equal(isShipmentAddressStale("addr-1", "addr-2"), true);
  assert.equal(isShipmentAddressStale("addr-1", "addr-1"), false);
  assert.equal(isShipmentAddressStale("addr-1", null), false);
});
