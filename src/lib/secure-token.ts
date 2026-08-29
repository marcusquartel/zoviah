/**
 * Bearer tokens for private supplemental-request links (Phase 4).
 *
 * The raw token is a secret: ~256 bits of entropy, URL-safe, shown to the
 * admin exactly once, and NEVER stored. The database only ever holds
 * `hashToken(raw)`. Pure — no I/O, no DB — so it is unit-testable.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 32 random bytes → 43-char base64url string. */
export function generateSecureToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 of the raw token, lowercase hex (64 chars). Deterministic. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/**
 * Shape check only — not authentication. A base64url token from
 * `generateSecureToken()` is 43 chars; accept a small range so a trailing
 * "=" or minor client mangling still reaches the (constant-time) hash lookup.
 */
export function isPlausibleToken(raw: unknown): raw is string {
  return typeof raw === "string" && /^[A-Za-z0-9_-]{32,64}$/.test(raw);
}

/** Constant-time compare of two hex hashes (defence in depth for any in-process check). */
export function hashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
