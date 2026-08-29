import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateSecureToken,
  hashToken,
  hashesEqual,
  isPlausibleToken,
} from "../src/lib/secure-token.ts";

test("generateSecureToken: URL-safe, ~256 bits, unique per call", () => {
  const a = generateSecureToken();
  assert.match(a, /^[A-Za-z0-9_-]+$/); // base64url alphabet only
  assert.equal(a.length, 43); // 32 bytes -> 43 base64url chars
  // 1000 tokens, no collision
  const seen = new Set<string>();
  for (let i = 0; i < 1000; i += 1) seen.add(generateSecureToken());
  assert.equal(seen.size, 1000);
});

test("hashToken: deterministic SHA-256 hex, 64 chars, != raw", () => {
  const raw = generateSecureToken();
  const h1 = hashToken(raw);
  const h2 = hashToken(raw);
  assert.equal(h1, h2);
  assert.match(h1, /^[0-9a-f]{64}$/);
  assert.notEqual(h1, raw);
  // a known vector
  assert.equal(
    hashToken("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("hashToken: different inputs -> different hashes", () => {
  assert.notEqual(hashToken("a"), hashToken("b"));
});

test("isPlausibleToken: shape check only", () => {
  assert.equal(isPlausibleToken(generateSecureToken()), true);
  assert.equal(isPlausibleToken("short"), false);
  assert.equal(isPlausibleToken("has spaces and !!!"), false);
  assert.equal(isPlausibleToken(""), false);
  assert.equal(isPlausibleToken(null), false);
  assert.equal(isPlausibleToken(123), false);
});

test("hashesEqual: constant-time equality of hex hashes", () => {
  const h = hashToken("x");
  assert.equal(hashesEqual(h, h), true);
  assert.equal(hashesEqual(h, hashToken("y")), false);
  assert.equal(hashesEqual(h, "deadbeef"), false); // length mismatch
});
