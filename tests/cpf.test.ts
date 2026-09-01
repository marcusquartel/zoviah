import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidCpf, formatCpf, stripCpf } from "../src/lib/validation/cpf.ts";

test("isValidCpf: accepts well-formed CPFs, masked or bare", () => {
  assert.equal(isValidCpf("111.444.777-35"), true);
  assert.equal(isValidCpf("11144477735"), true);
  assert.equal(isValidCpf("529.982.247-25"), true);
});

test("isValidCpf: rejects wrong check digits, repeated digits, bad length", () => {
  assert.equal(isValidCpf("111.444.777-00"), false); // check digits wrong
  assert.equal(isValidCpf("111.111.111-11"), false); // all repeated
  assert.equal(isValidCpf("000.000.000-00"), false);
  assert.equal(isValidCpf("123"), false);
  assert.equal(isValidCpf("1114447773512"), false); // too long
  assert.equal(isValidCpf(""), false);
});

test("formatCpf / stripCpf", () => {
  assert.equal(formatCpf("11144477735"), "111.444.777-35");
  assert.equal(formatCpf("111.444.777-35"), "111.444.777-35");
  assert.equal(formatCpf("123"), "123"); // left as-is when not 11 digits
  assert.equal(stripCpf("111.444.777-35"), "11144477735");
});
