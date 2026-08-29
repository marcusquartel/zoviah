import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeCpf, isValidCpf, formatCpf } from "../src/lib/cpf.ts";

test("normalizeCpf: valid CPF (with and without mask) -> 11 digits", () => {
  assert.equal(normalizeCpf("111.444.777-35"), "11144477735");
  assert.equal(normalizeCpf("11144477735"), "11144477735");
  assert.equal(normalizeCpf(" 111 444 777 35 "), "11144477735");
});

test("normalizeCpf: wrong check digits -> null", () => {
  assert.equal(normalizeCpf("11144477734"), null);
  assert.equal(normalizeCpf("12345678900"), null);
});

test("normalizeCpf: repeated digit -> null (even though the math would pass)", () => {
  for (const d of "0123456789") {
    assert.equal(normalizeCpf(d.repeat(11)), null);
  }
});

test("normalizeCpf: wrong length / junk -> null", () => {
  assert.equal(normalizeCpf("111444777"), null);
  assert.equal(normalizeCpf("111444777350"), null);
  assert.equal(normalizeCpf("abc"), null);
  assert.equal(normalizeCpf(""), null);
  assert.equal(normalizeCpf(null), null);
});

test("isValidCpf mirrors normalizeCpf", () => {
  assert.equal(isValidCpf("529.982.247-25"), true); // known-valid fake
  assert.equal(isValidCpf("529.982.247-24"), false);
});

test("formatCpf: 11 digits -> masked; otherwise pass-through", () => {
  assert.equal(formatCpf("11144477735"), "111.444.777-35");
  assert.equal(formatCpf("111.444.777-35"), "111.444.777-35");
  assert.equal(formatCpf("123"), "123");
});
