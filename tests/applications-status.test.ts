import { test } from "node:test";
import assert from "node:assert/strict";
import {
  APPLICATION_STATUSES,
  APPLICATION_STATUS_LABELS,
  canTransition,
  nextStatuses,
  SECURE_ONLY_TRANSITIONS,
  statusActionLabel,
  VALID_TRANSITIONS,
} from "../src/features/applications/status.ts";
import type { ApplicationStatus } from "../src/types/database.ts";

// The full conceptual graph — must match is_valid_application_transition() in
// migration 20260829000002. The three "secure-only" edges (approved →
// awaiting_address, awaiting_address → completed, awaiting_address → approved)
// are valid transitions but never offered as a manual status change.
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
  ["approved", "awaiting_address"],
  ["awaiting_address", "completed"],
  ["awaiting_address", "approved"],
  ["awaiting_address", "archived"],
  ["completed", "archived"],
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

test("nextStatuses = VALID_TRANSITIONS minus the secure-only edges", () => {
  for (const from of APPLICATION_STATUSES) {
    const expected = VALID_TRANSITIONS[from].filter(
      (to) => !SECURE_ONLY_TRANSITIONS.has(`${from}>${to}`),
    );
    assert.deepEqual(nextStatuses(from), expected);
  }
  // A manual caller can only archive an approved / awaiting_address / completed app.
  assert.deepEqual(nextStatuses("approved"), ["archived"]);
  assert.deepEqual(nextStatuses("awaiting_address"), ["archived"]);
  assert.deepEqual(nextStatuses("completed"), ["archived"]);
});

test("secure-only edges are still valid transitions, just not manual", () => {
  assert.equal(canTransition("approved", "awaiting_address"), true);
  assert.equal(canTransition("awaiting_address", "completed"), true);
  assert.equal(canTransition("awaiting_address", "approved"), true);
  for (const edge of SECURE_ONLY_TRANSITIONS) {
    const [from, to] = edge.split(">") as [ApplicationStatus, ApplicationStatus];
    assert.ok(!nextStatuses(from).includes(to), `${edge} must not be manual`);
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
