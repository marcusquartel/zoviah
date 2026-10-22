import { test } from "node:test";
import assert from "node:assert/strict";
import { computeAchievements, nextAchievement } from "../src/lib/portal/achievements.ts";

const base = { monthOrders: 0, monthSales: 0, totalOrders: 0, position: null, streakMonths: 0 };

test("nothing unlocked without sales; next goal is the first sale", () => {
  const list = computeAchievements(base);
  assert.equal(list.filter((a) => a.unlocked).length, 0);
  assert.equal(nextAchievement(list)?.id, "first");
});

test("counts and money badges unlock at their thresholds", () => {
  const list = computeAchievements({ ...base, monthOrders: 5, monthSales: 1000, totalOrders: 8, position: 4, streakMonths: 1 });
  const on = new Set(list.filter((a) => a.unlocked).map((a) => a.id));
  assert.deepEqual([...on].sort(), ["1k", "first", "five"]);
  const ten = list.find((a) => a.id === "ten")!;
  assert.equal(ten.remaining, "faltam 5 vendas");
  assert.equal(ten.progress, 0.5);
});

test("podium and champion need a sale this month", () => {
  const none = computeAchievements({ ...base, position: 1 });
  assert.equal(none.find((a) => a.id === "champion")!.unlocked, false);
  const champ = computeAchievements({ ...base, monthOrders: 1, totalOrders: 1, position: 1 });
  assert.equal(champ.find((a) => a.id === "champion")!.unlocked, true);
  assert.equal(champ.find((a) => a.id === "podium")!.unlocked, true);
});

test("singular wording", () => {
  const list = computeAchievements({ ...base, monthOrders: 4, totalOrders: 4, streakMonths: 2 });
  assert.equal(list.find((a) => a.id === "five")!.remaining, "faltam 1 venda");
  assert.equal(list.find((a) => a.id === "streak")!.remaining, "faltam 1 mês");
});
