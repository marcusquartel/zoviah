import { test } from "node:test";
import assert from "node:assert/strict";
import { buildThemeCss } from "../src/lib/theme.ts";

test("returns null when no colors are set", () => {
  assert.equal(buildThemeCss({}), null);
  assert.equal(
    buildThemeCss({ primaryColor: null, secondaryColor: undefined }),
    null,
  );
});

test("ignores malformed hex values", () => {
  assert.equal(buildThemeCss({ primaryColor: "blue" }), null);
  assert.equal(buildThemeCss({ primaryColor: "#12" }), null);
  assert.equal(buildThemeCss({ primaryColor: "4F46E5" }), null);
});

test("emits overrides for valid hex values", () => {
  const css = buildThemeCss({
    primaryColor: "#4F46E5",
    secondaryColor: "#e0e7ff",
  });
  assert.ok(css);
  assert.match(css!, /^:root\{/);
  assert.ok(css!.includes("--primary: #4F46E5;"));
  assert.ok(css!.includes("--secondary: #e0e7ff;"));
});

test("accepts shorthand hex and handles a single color", () => {
  const css = buildThemeCss({ primaryColor: "#abc" });
  assert.equal(css, ":root{--primary: #abc;--sidebar-primary: #abc;--ring: #abc;}");
});
