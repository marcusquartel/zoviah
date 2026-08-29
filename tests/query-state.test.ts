import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CREATOR_QUERY,
  hasActiveFilters,
  parseCreatorQuery,
  serializeCreatorQuery,
} from "../src/lib/query-state.ts";

test("parse: empty params -> defaults", () => {
  assert.deepEqual(parseCreatorQuery(new URLSearchParams()), DEFAULT_CREATOR_QUERY);
});

test("parse: reads and validates known params", () => {
  const q = parseCreatorQuery(
    new URLSearchParams(
      "q=  mariana  &program=abc&status=approved&city=Belo&has_ig=1&sort=name_asc&view=kanban&page=3",
    ),
  );
  assert.equal(q.q, "mariana");
  assert.equal(q.program, "abc");
  assert.equal(q.status, "approved");
  assert.equal(q.city, "Belo");
  assert.equal(q.hasInstagram, true);
  assert.equal(q.hasTiktok, false);
  assert.equal(q.sort, "name_asc");
  assert.equal(q.view, "kanban");
  assert.equal(q.page, 3);
});

test("parse: bad values fall back to defaults", () => {
  const q = parseCreatorQuery(
    new URLSearchParams("status=banana&sort=nope&view=weird&page=-4"),
  );
  assert.equal(q.status, null);
  assert.equal(q.sort, "recent");
  assert.equal(q.view, "list");
  assert.equal(q.page, 1);
});

test("parse: accepts a plain object (Next searchParams shape)", () => {
  const q = parseCreatorQuery({ status: "new", q: "x", page: "2" });
  assert.equal(q.status, "new");
  assert.equal(q.q, "x");
  assert.equal(q.page, 2);
});

test("serialize: omits defaults, keeps set values", () => {
  assert.equal(serializeCreatorQuery({}), "");
  assert.equal(
    serializeCreatorQuery({ view: "kanban", status: "new" }),
    "status=new&view=kanban",
  );
  assert.equal(serializeCreatorQuery({ sort: "recent" }), "");
});

test("round-trip", () => {
  const original = parseCreatorQuery(
    new URLSearchParams("q=ana&program=p1&status=archived&has_tt=1&sort=tt_desc&view=kanban"),
  );
  const round = parseCreatorQuery(
    new URLSearchParams(serializeCreatorQuery(original)),
  );
  assert.deepEqual({ ...round, page: 1 }, { ...original, page: 1 });
});

test("hasActiveFilters ignores view/sort/page", () => {
  assert.equal(hasActiveFilters(DEFAULT_CREATOR_QUERY), false);
  assert.equal(
    hasActiveFilters({ ...DEFAULT_CREATOR_QUERY, view: "kanban", sort: "name_asc", page: 5 }),
    false,
  );
  assert.equal(
    hasActiveFilters({ ...DEFAULT_CREATOR_QUERY, q: "x" }),
    true,
  );
  assert.equal(
    hasActiveFilters({ ...DEFAULT_CREATOR_QUERY, hasTiktok: true }),
    true,
  );
});
