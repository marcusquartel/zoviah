import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildContentSecurityPolicy,
  baseSecurityHeaders,
  globalSecurityHeaders,
} from "../src/lib/security-headers.ts";

test("CSP: allow-lists the Supabase origin + wss, keeps framing off", () => {
  const csp = buildContentSecurityPolicy("https://abc.supabase.co");
  assert.match(csp, /connect-src [^;]*https:\/\/abc\.supabase\.co/);
  assert.match(csp, /connect-src [^;]*wss:\/\/abc\.supabase\.co/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
  // tenant logos are arbitrary https URLs
  assert.match(csp, /img-src [^;]*https:/);
});

test("CSP: a missing/blank Supabase URL degrades to connect-src 'self'", () => {
  const csp = buildContentSecurityPolicy(undefined);
  assert.match(csp, /connect-src 'self'/);
  assert.doesNotMatch(csp, /supabase/);
});

test("base headers: HSTS only in production", () => {
  const dev = baseSecurityHeaders({ isProduction: false });
  const prod = baseSecurityHeaders({ isProduction: true });
  assert.ok(!dev.some((h) => h.key === "Strict-Transport-Security"));
  assert.ok(prod.some((h) => h.key === "Strict-Transport-Security"));
  for (const set of [dev, prod]) {
    assert.equal(set.find((h) => h.key === "X-Content-Type-Options")?.value, "nosniff");
    assert.equal(set.find((h) => h.key === "X-Frame-Options")?.value, "DENY");
    assert.match(set.find((h) => h.key === "Referrer-Policy")?.value ?? "", /strict-origin/);
    assert.match(set.find((h) => h.key === "Permissions-Policy")?.value ?? "", /camera=\(\)/);
  }
});

test("global headers: CSP ships Report-Only (non-blocking) first", () => {
  const headers = globalSecurityHeaders({
    isProduction: true,
    supabaseUrl: "https://abc.supabase.co",
  });
  assert.ok(headers.some((h) => h.key === "Content-Security-Policy-Report-Only"));
  assert.ok(!headers.some((h) => h.key === "Content-Security-Policy"));
});
