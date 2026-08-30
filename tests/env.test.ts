import { test } from "node:test";
import assert from "node:assert/strict";
import { checkProductionEnv } from "../src/lib/env/production.ts";

const BASE = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abc.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_xxx",
  NEXT_PUBLIC_APP_URL: "https://hub.example.com",
  NEXT_PUBLIC_TERMS_URL: "https://example.com/terms",
  NEXT_PUBLIC_PRIVACY_POLICY_URL: "https://example.com/privacy",
};

test("env: a complete production env is production-ready", () => {
  const r = checkProductionEnv(BASE, { isProduction: true });
  assert.equal(r.productionReady, true);
  assert.equal(r.errors.length, 0);
});

test("env: missing APP_URL blocks production, only warns in dev", () => {
  const prod = checkProductionEnv(
    { ...BASE, NEXT_PUBLIC_APP_URL: undefined },
    { isProduction: true },
  );
  assert.equal(prod.productionReady, false);
  assert.ok(prod.errors.some((c) => c.key === "NEXT_PUBLIC_APP_URL"));

  const dev = checkProductionEnv(
    { ...BASE, NEXT_PUBLIC_APP_URL: undefined },
    { isProduction: false },
  );
  assert.equal(dev.productionReady, true);
  assert.ok(dev.warnings.some((c) => c.key === "NEXT_PUBLIC_APP_URL"));
});

test("env: APP_URL must be https and not localhost in production", () => {
  for (const bad of ["http://hub.example.com", "https://localhost:3001", "https://127.0.0.1"]) {
    const r = checkProductionEnv(
      { ...BASE, NEXT_PUBLIC_APP_URL: bad },
      { isProduction: true },
    );
    assert.equal(r.productionReady, false, `${bad} should block`);
  }
});

test("env: legal URLs — junk / non-http is an error, missing blocks prod", () => {
  const junk = checkProductionEnv(
    { ...BASE, NEXT_PUBLIC_TERMS_URL: "javascript:alert(1)" },
    { isProduction: true },
  );
  assert.ok(junk.checks.some((c) => c.key === "NEXT_PUBLIC_TERMS_URL" && c.severity === "error"));

  const missing = checkProductionEnv(
    { ...BASE, NEXT_PUBLIC_PRIVACY_POLICY_URL: undefined },
    { isProduction: true },
  );
  assert.equal(missing.productionReady, false);
});

test("env: Anthropic absence is a non-blocking warning (Score + Support degrade)", () => {
  const r = checkProductionEnv(BASE, { isProduction: true });
  const score = r.checks.find((c) => c.key === "ANTHROPIC_MODEL");
  const support = r.checks.find((c) => c.key === "ANTHROPIC_SUPPORT_MODEL");
  assert.equal(score?.severity, "warn");
  assert.equal(score?.blocking, false);
  assert.equal(support?.severity, "warn");
  assert.equal(support?.blocking, false);

  const withAnth = checkProductionEnv(
    { ...BASE, ANTHROPIC_API_KEY: "sk-ant-x", ANTHROPIC_MODEL: "claude-sonnet-5", ANTHROPIC_SUPPORT_MODEL: "claude-haiku-4-5" },
    { isProduction: true },
  );
  assert.equal(withAnth.checks.find((c) => c.key === "ANTHROPIC_MODEL")?.severity, "ok");
  assert.equal(withAnth.checks.find((c) => c.key === "ANTHROPIC_SUPPORT_MODEL")?.severity, "ok");
});

test("env: a NEXT_PUBLIC_ secret is always a blocking error", () => {
  const r = checkProductionEnv(
    { ...BASE, NEXT_PUBLIC_ANTHROPIC_API_KEY: "sk-ant-leak" },
    { isProduction: false },
  );
  assert.equal(r.productionReady, false);
  assert.ok(
    r.errors.some((c) => c.key === "NEXT_PUBLIC_ANTHROPIC_API_KEY" && c.blocking),
  );
});

test("env: missing Supabase is always blocking", () => {
  const r = checkProductionEnv(
    { NEXT_PUBLIC_APP_URL: "https://hub.example.com" },
    { isProduction: false },
  );
  assert.equal(r.productionReady, false);
  assert.ok(r.errors.some((c) => c.key === "NEXT_PUBLIC_SUPABASE_URL"));
  assert.ok(r.errors.some((c) => c.key === "NEXT_PUBLIC_SUPABASE_ANON_KEY"));
});
