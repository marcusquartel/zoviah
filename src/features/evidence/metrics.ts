/**
 * Derived social metrics (§16). PURE — no I/O, no score.
 *
 * These are EVIDENCE, not grades. Nothing here feeds `creator-score-v1`
 * (§46, §68). A future `creator-score-v2` (its own phase) will calibrate
 * thresholds from the real distribution these snapshots produce.
 *
 * Every function returns `null` when its inputs are missing — never 0, never a
 * guess (§95).
 */
import type { SocialMetricSnapshot } from "@/types/database";

/** Median (§11): odd -> middle, even -> mean of the two middle values. */
export function median(values: number[]): number | null {
  const nums = values.filter((n) => Number.isFinite(n) && n >= 0);
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function mean(values: number[]): number | null {
  const nums = values.filter((n) => Number.isFinite(n) && n >= 0);
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function ratio(numerator: number | null, denominator: number | null): number | null {
  if (numerator == null || denominator == null || denominator <= 0) return null;
  return numerator / denominator;
}

/** median_views / followers (§17). NOT engagement — this is "View Rate". */
export function viewRate(
  medianViews: number | null,
  followers: number | null,
): number | null {
  return ratio(medianViews, followers);
}

/** likes + comments, only when both are present (§18). */
export function averageInteractions(
  likes: number | null,
  comments: number | null,
): number | null {
  if (likes == null || comments == null) return null;
  return likes + comments;
}

/** interactions / followers (§18). Show the denominator in the UI. */
export function engagementByFollowers(
  interactions: number | null,
  followers: number | null,
): number | null {
  return ratio(interactions, followers);
}

/** interactions / reach (§18). Show the denominator in the UI. */
export function engagementByReach(
  interactions: number | null,
  reach: number | null,
): number | null {
  return ratio(interactions, reach);
}

/** posts_count / period_days * 7 (§19). */
export function postsPerWeek(
  postsCount: number | null,
  periodDays: number | null,
): number | null {
  if (postsCount == null || periodDays == null || periodDays <= 0) return null;
  return (postsCount / periodDays) * 7;
}

/** Follower delta between two snapshots (§20). `previous` must be > 0 for rate. */
export function followerGrowth(
  current: number | null,
  previous: number | null,
): { absolute: number; rate: number | null; days: number | null } | null {
  if (current == null || previous == null) return null;
  const absolute = current - previous;
  return {
    absolute,
    rate: previous > 0 ? absolute / previous : null,
    days: null,
  };
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round(
    (new Date(toIso).getTime() - new Date(fromIso).getTime()) / 86_400_000,
  );
}

// ---------------------------------------------------------------------------
// Everything a snapshot (optionally with a previous one) derives, for the UI
// and for the sanitized analysis payload.
// ---------------------------------------------------------------------------
export interface DerivedMetrics {
  followers: number | null;
  medianViews: number | null;
  averageViews: number | null;
  sampleSize: number;
  medianViewRate: number | null;
  averageInteractions: number | null;
  engagementByFollowers: number | null;
  engagementByReach: number | null;
  postsPerWeek: number | null;
  reach: number | null;
  interactions: number | null;
  followerGrowthAbsolute: number | null;
  followerGrowthRate: number | null;
  growthPeriodDays: number | null;
  snapshotAgeDays: number;
  source: SocialMetricSnapshot["source"];
}

export function deriveSnapshotMetrics(
  snapshot: SocialMetricSnapshot,
  previous: SocialMetricSnapshot | null,
  now: Date = new Date(),
): DerivedMetrics {
  const interactions =
    snapshot.interactions ??
    averageInteractions(snapshot.average_likes, snapshot.average_comments);

  const growth = previous
    ? followerGrowth(snapshot.followers, previous.followers)
    : null;

  return {
    followers: snapshot.followers,
    medianViews: snapshot.median_views,
    averageViews: snapshot.average_views,
    sampleSize: Array.isArray(snapshot.views_sample)
      ? snapshot.views_sample.length
      : 0,
    medianViewRate: viewRate(snapshot.median_views, snapshot.followers),
    averageInteractions: interactions,
    engagementByFollowers: engagementByFollowers(
      interactions,
      snapshot.followers,
    ),
    engagementByReach: engagementByReach(interactions, snapshot.reach),
    postsPerWeek: postsPerWeek(snapshot.posts_count, snapshot.period_days),
    reach: snapshot.reach,
    interactions,
    followerGrowthAbsolute: growth?.absolute ?? null,
    followerGrowthRate: growth?.rate ?? null,
    growthPeriodDays: previous
      ? daysBetween(previous.observed_at, snapshot.observed_at)
      : null,
    snapshotAgeDays: daysBetween(snapshot.observed_at, now.toISOString()),
    source: snapshot.source,
  };
}
