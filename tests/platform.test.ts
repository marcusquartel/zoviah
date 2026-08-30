import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLAN_CODES,
  PLAN_LABELS,
  ORG_STATUS_LABELS,
  INVITE_STATUS_LABELS,
  ORG_INVITE_TTL_DAYS,
  isPlanCode,
} from "../src/features/platform/plans.ts";
import { deriveOnboardingState } from "../src/features/onboarding/state.ts";

test("plan codes: the five commercial conditions, all labelled", () => {
  assert.deepEqual([...PLAN_CODES], [
    "founding",
    "starter",
    "pro",
    "agency",
    "enterprise",
  ]);
  for (const p of PLAN_CODES) assert.equal(typeof PLAN_LABELS[p], "string");
  assert.equal(isPlanCode("founding"), true);
  assert.equal(isPlanCode("free"), false);
});

test("status / invite labels are complete", () => {
  for (const s of ["active", "inactive", "suspended"] as const) {
    assert.equal(typeof ORG_STATUS_LABELS[s], "string");
  }
  for (const s of ["pending", "accepted", "expired", "revoked"] as const) {
    assert.equal(typeof INVITE_STATUS_LABELS[s], "string");
  }
  assert.equal(ORG_INVITE_TTL_DAYS, 14);
});

const NONE = {
  hasBrand: false,
  hasProgram: false,
  hasPublishedProgram: false,
  teamInvited: false,
  hasApplication: false,
};

test("onboarding: nothing done -> 0/5, not complete", () => {
  const s = deriveOnboardingState(NONE);
  assert.equal(s.doneCount, 0);
  assert.equal(s.total, 5);
  assert.equal(s.complete, false);
  assert.deepEqual(
    s.steps.map((x) => x.key),
    [
      "hasBrand",
      "hasProgram",
      "hasPublishedProgram",
      "teamInvited",
      "hasApplication",
    ],
  );
  for (const step of s.steps) {
    assert.equal(step.done, false);
    assert.ok(step.href.startsWith("/app/"));
    assert.ok(step.label.length > 0);
  }
});

test("onboarding: partial -> correct count and per-step flags", () => {
  const s = deriveOnboardingState({
    ...NONE,
    hasBrand: true,
    hasProgram: true,
  });
  assert.equal(s.doneCount, 2);
  assert.equal(s.complete, false);
  assert.equal(s.steps.find((x) => x.key === "hasBrand")?.done, true);
  assert.equal(s.steps.find((x) => x.key === "hasApplication")?.done, false);
});

test("onboarding: everything derived true -> complete", () => {
  const s = deriveOnboardingState({
    hasBrand: true,
    hasProgram: true,
    hasPublishedProgram: true,
    teamInvited: true,
    hasApplication: true,
  });
  assert.equal(s.doneCount, 5);
  assert.equal(s.complete, true);
});
