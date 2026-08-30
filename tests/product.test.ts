import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FEATURE_STATUS_LABELS,
  FREQUENCY_LABELS,
  IMPORTANCE_LABELS,
  ROADMAP_STATUS_LABELS,
  ROADMAP_STATUS_ORDER,
  CHANGELOG_STATUS_LABELS,
  VOTE_SCOPE_NOTE,
} from "../src/features/product/labels.ts";

test("feature-request labels: every enum value covered", () => {
  for (const k of [
    "submitted",
    "under_review",
    "planned",
    "in_progress",
    "released",
    "declined",
  ] as const) {
    assert.equal(typeof FEATURE_STATUS_LABELS[k], "string");
  }
  for (const k of ["rarely", "sometimes", "often", "daily"] as const) {
    assert.equal(typeof FREQUENCY_LABELS[k], "string");
  }
  for (const k of ["nice_to_have", "important", "essential"] as const) {
    assert.equal(typeof IMPORTANCE_LABELS[k], "string");
  }
});

test("roadmap labels match the spec wording (Em avaliação / Planejado / Em desenvolvimento / Lançado)", () => {
  assert.equal(ROADMAP_STATUS_LABELS.under_consideration, "Em avaliação");
  assert.equal(ROADMAP_STATUS_LABELS.planned, "Planejado");
  assert.equal(ROADMAP_STATUS_LABELS.in_progress, "Em desenvolvimento");
  assert.equal(ROADMAP_STATUS_LABELS.released, "Lançado");
  // Active work is shown before shipped items.
  assert.deepEqual(ROADMAP_STATUS_ORDER, [
    "in_progress",
    "planned",
    "under_consideration",
    "released",
  ]);
});

test("roadmap labels never imply a date or deadline (§39)", () => {
  const all = Object.values(ROADMAP_STATUS_LABELS).join(" ").toLowerCase();
  for (const banned of [
    "prazo",
    "data",
    "deadline",
    "trimestre",
    "q1",
    "q2",
    "q3",
    "q4",
    "semana",
    "mês",
    "mes ",
  ]) {
    assert.ok(!all.includes(banned), `label leaks a time promise: ${banned}`);
  }
});

test("changelog labels + org-scoped vote note (§37)", () => {
  assert.equal(CHANGELOG_STATUS_LABELS.draft, "Rascunho");
  assert.equal(CHANGELOG_STATUS_LABELS.published, "Publicado");
  assert.match(VOTE_SCOPE_NOTE, /organiza/i);
  assert.match(VOTE_SCOPE_NOTE, /um voto/i);
});
