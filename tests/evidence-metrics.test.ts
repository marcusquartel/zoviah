import { test } from "node:test";
import assert from "node:assert/strict";
import {
  median,
  mean,
  viewRate,
  averageInteractions,
  engagementByFollowers,
  engagementByReach,
  postsPerWeek,
  followerGrowth,
  daysBetween,
  deriveSnapshotMetrics,
} from "../src/features/evidence/metrics.ts";
import type { SocialMetricSnapshot } from "../src/types/database.ts";

const close = (actual: number | null, expected: number, eps = 1e-9) => {
  assert.ok(
    actual != null && Math.abs(actual - expected) < eps,
    `expected ~${expected}, got ${actual}`,
  );
};

function snap(over: Partial<SocialMetricSnapshot> = {}): SocialMetricSnapshot {
  return {
    id: "snap-1",
    organization_id: "org-1",
    creator_id: "cr-1",
    social_profile_id: "sp-1",
    source: "admin_manual",
    observed_at: "2026-08-01T00:00:00.000Z",
    period_days: null,
    followers: null,
    average_views: null,
    median_views: null,
    views_sample: null,
    average_likes: null,
    average_comments: null,
    average_shares: null,
    average_saves: null,
    reach: null,
    interactions: null,
    posts_count: null,
    notes: null,
    created_by: null,
    created_at: "2026-08-01T00:00:00.000Z",
    updated_at: "2026-08-01T00:00:00.000Z",
    ...over,
  };
}

test("median: odd length -> middle value", () => {
  assert.equal(median([10, 20, 30]), 20);
  assert.equal(median([30, 10, 20]), 20); // unsorted input
});

test("median: even length -> mean of the two middle values", () => {
  assert.equal(median([10, 20, 30, 40]), 25);
});

test("median / mean: empty -> null (never 0)", () => {
  assert.equal(median([]), null);
  assert.equal(mean([]), null);
});

test("median / mean: negatives and NaN are dropped, not coerced to 0", () => {
  assert.equal(median([10, -5, 20, Number.NaN, 30]), 20);
  assert.equal(mean([10, 20, Number.NaN]), 15);
});

test("mean: arithmetic average", () => {
  assert.equal(mean([10, 20, 30]), 20);
  assert.equal(mean([7100, 9480, 5230]), 7270);
});

test("viewRate = median_views / followers; null when followers <= 0 or missing", () => {
  assert.equal(viewRate(4100, 10000), 0.41);
  assert.equal(viewRate(4100, 0), null);
  assert.equal(viewRate(4100, null), null);
  assert.equal(viewRate(null, 10000), null);
});

test("averageInteractions = likes + comments only when BOTH present", () => {
  assert.equal(averageInteractions(300, 20), 320);
  assert.equal(averageInteractions(300, null), null);
  assert.equal(averageInteractions(null, 20), null);
});

test("engagement is exposed against BOTH denominators, not one 'official' rate", () => {
  assert.equal(engagementByFollowers(320, 10000), 0.032);
  assert.equal(engagementByReach(320, 8000), 0.04);
  assert.equal(engagementByReach(320, 0), null);
});

test("postsPerWeek = posts_count / period_days * 7", () => {
  close(postsPerWeek(12, 30), 2.8);
  assert.equal(postsPerWeek(4, 28), 1);
  assert.equal(postsPerWeek(5, null), null);
  assert.equal(postsPerWeek(null, 30), null);
  assert.equal(postsPerWeek(5, 0), null);
});

test("followerGrowth: absolute always; rate only when previous > 0", () => {
  assert.deepEqual(followerGrowth(11000, 10000), {
    absolute: 1000,
    rate: 0.1,
    days: null,
  });
  assert.deepEqual(followerGrowth(500, 0), {
    absolute: 500,
    rate: null,
    days: null,
  });
  assert.equal(followerGrowth(11000, null), null);
});

test("daysBetween counts whole days", () => {
  assert.equal(
    daysBetween("2026-08-01T00:00:00.000Z", "2026-08-31T00:00:00.000Z"),
    30,
  );
});

test("deriveSnapshotMetrics: null propagation when the snapshot is nearly empty", () => {
  const d = deriveSnapshotMetrics(
    snap({ followers: 10000 }),
    null,
    new Date("2026-08-11T00:00:00.000Z"),
  );
  assert.equal(d.followers, 10000);
  assert.equal(d.medianViews, null);
  assert.equal(d.medianViewRate, null);
  assert.equal(d.postsPerWeek, null);
  assert.equal(d.engagementByFollowers, null);
  assert.equal(d.followerGrowthAbsolute, null);
  assert.equal(d.followerGrowthRate, null);
  assert.equal(d.sampleSize, 0);
  assert.equal(d.snapshotAgeDays, 10);
  assert.equal(d.source, "admin_manual");
});

test("deriveSnapshotMetrics: full snapshot + previous -> derived values, no platform mixing", () => {
  const previous = snap({
    id: "prev",
    observed_at: "2026-07-01T00:00:00.000Z",
    followers: 10000,
  });
  const latest = snap({
    observed_at: "2026-07-31T00:00:00.000Z",
    followers: 11000,
    median_views: 4400,
    average_views: 5000,
    views_sample: [4000, 4400, 6000],
    average_likes: 300,
    average_comments: 20,
    reach: 8000,
    posts_count: 12,
    period_days: 30,
  });
  const d = deriveSnapshotMetrics(
    latest,
    previous,
    new Date("2026-08-10T00:00:00.000Z"),
  );
  close(d.medianViewRate, 0.4);
  close(d.postsPerWeek, 2.8);
  assert.equal(d.averageInteractions, 320);
  close(d.engagementByFollowers, 320 / 11000);
  close(d.engagementByReach, 0.04);
  assert.equal(d.followerGrowthAbsolute, 1000);
  assert.equal(d.followerGrowthRate, 0.1);
  assert.equal(d.growthPeriodDays, 30);
  assert.equal(d.sampleSize, 3);
});

test("deriveSnapshotMetrics: explicit interactions column wins over likes+comments", () => {
  const d = deriveSnapshotMetrics(
    snap({ followers: 10000, interactions: 999, average_likes: 1, average_comments: 1 }),
    null,
  );
  assert.equal(d.interactions, 999);
  assert.equal(d.engagementByFollowers, 999 / 10000);
});
