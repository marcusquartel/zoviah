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

// The exact table from the Phase 2 spec (§6). This is the contract that must
// match is_valid_application_transition() in the migration.
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

test("nextStatuses matches VALID_TRANSITIONS", () => {
  for (const from of APPLICATION_STATUSES) {
    assert.deepEqual(nextStatuses(from), VALID_TRANSITIONS[from]);
  }
  assert.deepEqual(nextStatuses("approved"), ["archived"]);
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
