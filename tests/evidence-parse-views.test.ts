import { test } from "node:test";
import assert from "node:assert/strict";
import { parseViews } from "../src/features/evidence/parse-views.ts";

test("pt-BR: '7.100' is 7100 (thousands separator), NOT 7.1", () => {
  assert.deepEqual(parseViews("7.100").values, [7100]);
  assert.deepEqual(parseViews("1.234.567").values, [1234567]);
});

test("one number per line is the expected shape", () => {
  assert.deepEqual(parseViews("7.100\n9.480\n5.230").values, [7100, 9480, 5230]);
});

test("whitespace, comma and semicolon also separate", () => {
  assert.deepEqual(parseViews("100 200;300, 400").values, [100, 200, 300, 400]);
});

test("k / mil / mi suffixes (attached to the number)", () => {
  assert.deepEqual(parseViews("12k").values, [12000]);
  assert.deepEqual(parseViews("12mil").values, [12000]);
  // "." is always a grouping separator, so "1.2" is 12, then mi -> 12_000_000
  assert.deepEqual(parseViews("1.2mi").values, [12_000_000]);
  assert.deepEqual(parseViews("3m").values, [3_000_000]);
});

test("a comma splits tokens — it is never a decimal point", () => {
  // "1,2mi" is two tokens: 1 and 2mi
  assert.deepEqual(parseViews("1,2mi").values, [1, 2_000_000]);
});

test("invalid tokens are reported and dropped, never coerced to 0", () => {
  const r = parseViews("100\nmuitas\n-5\n\n200\nabc123");
  assert.deepEqual(r.values, [100, 200]);
  assert.deepEqual(r.invalid, ["muitas", "-5", "abc123"]);
  assert.ok(!r.values.includes(0));
});

test("empty input -> empty result", () => {
  assert.deepEqual(parseViews("").values, []);
  assert.deepEqual(parseViews("   \n  ").values, []);
});

test("all values are non-negative safe integers", () => {
  for (const n of parseViews("7.100\n12k\n999999999999999999999").values) {
    assert.ok(Number.isSafeInteger(n) && n >= 0);
  }
});
