import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  canTransition,
  nextStatuses,
  statusActionLabel,
  VALID_TRANSITIONS,
} from "../src/features/applications/status.ts";
import type { ApplicationStatus } from "../src/types/database.ts";

// The full graph — must match is_valid_application_transition() in migration
// 20260906000001. The address is collected on the public form, so there is no
// address step: approved only ever moves to archived.
const EXPECTED: [ApplicationStatus, ApplicationStatus][] = [
  ["new", "awaiting_review"],
  ["new", "approved"],
  ["new", "information_requested"],
  ["new", "archived"],
  ["awaiting_review", "approved"],
  ["awaiting_review", "information_requested"],
  ["awaiting_review", "archived"],
  ["information_requested", "awaiting_review"],
  ["information_requested", "approved"],
  ["information_requested", "archived"],
  ["approved", "archived"],
  ["archived", "awaiting_review"],
];

test("every spec transition is valid", () => {
  for (const [from, to] of EXPECTED) {
    assert.equal(canTransition(from, to), true, `${from} -> ${to}`);
  }
});

test("no transition outside the spec table is valid", () => {
  const allowed = new Set(EXPECTED.map(([f, t]) => `${f}>${t}`));
  for (const from of APPLICATION_STATUSES) {
    for (const to of APPLICATION_STATUSES) {
      const expected = allowed.has(`${from}>${to}`);
      assert.equal(
        canTransition(from, to),
        expected,
        `${from} -> ${to} should be ${expected}`,
      );
    }
  }
});

test("specific invalid transitions are rejected", () => {
  assert.equal(canTransition("approved", "approved"), false);
  assert.equal(canTransition("approved", "new"), false);
  assert.equal(canTransition("archived", "approved"), false);
  assert.equal(canTransition("new", "new"), false);
  assert.equal(canTransition("information_requested", "new"), false);
});

test("nextStatuses offers every valid transition", () => {
  for (const from of APPLICATION_STATUSES) {
    assert.deepEqual(nextStatuses(from), VALID_TRANSITIONS[from]);
  }
  assert.deepEqual(nextStatuses("approved"), ["archived"]);
});

test("the old address-step statuses are gone", () => {
  for (const removed of ["awaiting_address", "completed"]) {
    assert.ok(
      !(APPLICATION_STATUSES as readonly string[]).includes(removed),
      `${removed} must not be a status`,
    );
  }
});

test("labels exist for all statuses; reopen wording is special-cased", () => {
  for (const s of APPLICATION_STATUSES) {
    assert.equal(typeof APPLICATION_STATUS_LABELS[s], "string");
  }
  assert.equal(statusActionLabel("archived", "awaiting_review"), "Reabrir");
  assert.equal(statusActionLabel("new", "approved"), "Aprovar");
  assert.equal(
    statusActionLabel("new", "information_requested"),
    "Solicitar informações",
  );
});
