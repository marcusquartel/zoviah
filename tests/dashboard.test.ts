import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildAttention,
  bucketGrowth,
  growthRatePct,
  normalizeState,
  rank,
  titleCase,
} from "../src/features/dashboard/aggregate.ts";

test("titleCase: words > 2 chars capitalised, short words upper-cased", () => {
  assert.equal(titleCase("belo horizonte"), "Belo Horizonte");
  assert.equal(titleCase("RIO DE JANEIRO"), "Rio DE Janeiro");
  assert.equal(titleCase("  são   paulo "), "São Paulo");
});

test("normalizeState: 2-letter UF upper, longer title-cased", () => {
  assert.equal(normalizeState("rj"), "RJ");
  assert.equal(normalizeState("MG"), "MG");
  assert.equal(normalizeState("minas gerais"), "Minas Gerais");
});

test("rank: top-5 by count, alphabetical tie-break, blanks ignored", () => {
  const r = rank(
    ["BH", "BH", "SP", "", null, "SP", "RJ", "  ", "BH"],
  );
  assert.deepEqual(r, [
    { label: "BH", count: 3 },
    { label: "SP", count: 2 },
    { label: "RJ", count: 1 },
  ]);
});

test("rank: applies the normaliser and caps at the limit", () => {
  const r = rank(
    ["a", "a", "b", "c", "d", "e", "f"],
    (s) => s.toUpperCase(),
    3,
  );
  assert.equal(r.length, 3);
  assert.equal(r[0].label, "A");
});

test("growthRatePct: signed % vs previous; null with no baseline", () => {
  assert.equal(growthRatePct(15, 10), 50);
  assert.equal(growthRatePct(8, 10), -20);
  assert.equal(growthRatePct(5, 0), null);
  assert.equal(growthRatePct(0, 0), null);
});

test("bucketGrowth: cumulative total includes pre-window rows", () => {
  const now = Date.UTC(2026, 0, 31);
  const d = (day: number) => new Date(Date.UTC(2026, 0, day)).toISOString();
  // 2 before the 30-day window, 3 inside
  const dates = [d(-40 + 41), d(1), d(10), d(20), d(29)];
  const pts = bucketGrowth(dates, 30, now, 3);
  assert.equal(pts.length, 3);
  // last bucket total = everything = 5
  assert.equal(pts[pts.length - 1].total, 5);
  // added counts within the window sum to 4 (d1,d10,d20,d29 — d(1) via day 1)
  const added = pts.reduce((s, p) => s + p.added, 0);
  assert.ok(added >= 3 && added <= 5);
  // monotonic non-decreasing total
  for (let i = 1; i < pts.length; i += 1) {
    assert.ok(pts[i].total >= pts[i - 1].total);
  }
});

test("bucketGrowth: empty input yields zeroed buckets", () => {
  const pts = bucketGrowth([], 7, Date.now(), 4);
  assert.equal(pts.length, 4);
  assert.ok(pts.every((p) => p.total === 0 && p.added === 0));
});

test("buildAttention: missing address shows; possible duplicates never do", () => {
  const items = buildAttention(
    { awaiting_address: 3, possible_duplicate: 9, approved: 5 },
    2,
  );
  assert.deepEqual(
    items.map((i) => i.label),
    ["Aguardando endereço", "Análises que falharam"],
  );
  assert.ok(!items.some((i) => /duplicad/i.test(i.label)));
  assert.equal(items[0].count, 3);
  assert.equal(items[0].href, "/app/creators?status=awaiting_address");

  // nothing pending -> empty
  assert.deepEqual(buildAttention({ possible_duplicate: 4 }, 0), []);
  // only failed analyses
  assert.deepEqual(
    buildAttention({}, 1).map((i) => i.label),
    ["Análises que falharam"],
  );
});
