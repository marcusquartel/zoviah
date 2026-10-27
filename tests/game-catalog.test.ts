import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENTS,
  DEFAULT_AVATAR,
  ITEMS,
  ITEM_BY_ID,
  evaluateAchievements,
  sanitizeAvatar,
  unlockedItemIds,
  type GameStats,
} from "../src/lib/game/catalog.ts";

const zero: GameStats = {
  monthOrders: 0, monthSales: 0, totalOrders: 0, position: null, streakMonths: 0,
  monthContent: 0, monthStories: 0, totalContent: 0, tierLevel: null, interactionsReceived: 0, hennasCollected: 0,
};

test("every unlockedBy points to a real achievement and every default slot item exists", () => {
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  for (const i of ITEMS) if (i.unlockedBy) assert.ok(ids.has(i.unlockedBy), `${i.id} → ${i.unlockedBy}`);
  for (const [slot, id] of Object.entries(DEFAULT_AVATAR)) {
    const item = ITEM_BY_ID.get(id);
    assert.ok(item && item.slot === slot && !item.unlockedBy, `default ${slot}`);
  }
});

test("a new creator only has the free items", () => {
  const unlocked = unlockedItemIds(zero);
  assert.ok(unlocked.has("hair-long"));
  assert.ok(!unlocked.has("head-crown"));
  assert.ok(!unlocked.has("pet-bunny"));
});

test("achievements unlock their rewards", () => {
  const s = { ...zero, totalOrders: 1, monthOrders: 5, monthSales: 10000, position: 1, tierLevel: 3 };
  const unlocked = unlockedItemIds(s);
  for (const id of ["top-rareway", "head-band", "pet-bunny", "head-crown", "title-queen", "fx-aura-rara", "hc-lilac", "top-poderosa"]) {
    assert.ok(unlocked.has(id), id);
  }
  const champion = evaluateAchievements(s).find((a) => a.id === "champion")!;
  assert.equal(champion.unlocked, true);
  assert.ok(champion.realPrize);
});

test("sanitizeAvatar drops locked or wrong-slot items", () => {
  const cfg = sanitizeAvatar({ head: "head-crown", hair: "top-coat", skin: "skin-5" }, unlockedItemIds(zero));
  assert.equal(cfg.head, "head-none");
  assert.equal(cfg.hair, DEFAULT_AVATAR.hair);
  assert.equal(cfg.skin, "skin-5");
});

test("the SQL catalog (glance_world migration) matches ITEMS exactly", async () => {
  const { readFileSync, readdirSync } = await import("node:fs");
  const dir = new URL("../supabase/migrations/", import.meta.url);
  // The newest migration defining game_catalog wins.
  const file = readdirSync(dir)
    .filter((f) => readFileSync(new URL(f, dir), "utf8").includes("function public.game_catalog()"))
    .sort()
    .at(-1)!;
  const sql = readFileSync(new URL(file, dir), "utf8");
  const body = sql.slice(sql.indexOf("function public.game_catalog()"));
  const rows = [...body.slice(0, body.indexOf("as c(item_id")).matchAll(/\('([^']+)', '([^']+)', (null|'[^']+')\)/g)].map(
    (m) => `${m[1]}|${m[2]}|${m[3] === "null" ? "" : m[3].slice(1, -1)}`,
  );
  const ts = ITEMS.map((i) => `${i.id}|${i.slot}|${i.unlockedBy ?? ""}`);
  assert.deepEqual(rows.sort(), ts.sort());
});

test("SQL thresholds cover every achievement id", async () => {
  const { readFileSync } = await import("node:fs");
  const sql = readFileSync(new URL("../supabase/migrations/20261027000001_glance_world.sql", import.meta.url), "utf8");
  const body = sql.slice(sql.indexOf("function public.game_achievements"));
  for (const a of ACHIEVEMENTS) assert.ok(body.includes(`'${a.id}'`), a.id);
});
