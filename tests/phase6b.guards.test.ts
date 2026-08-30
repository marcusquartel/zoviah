/**
 * §69 — the support subsystem must never reach operational PII. These are
 * static source guards: they fail CI the moment a support file starts touching
 * addresses, raw request tokens, shipment address snapshots, or auth secrets.
 *
 * Pure — no network, runs in the standard suite.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function collect(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) collect(p, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(p);
  }
  return acc;
}

const SUPPORT_SOURCES = [
  ...collect("src/features/support"),
  ...collect("src/features/product"),
  "src/lib/anthropic/support-assistant.ts",
  "src/lib/anthropic/support-env.ts",
];

// Substrings that must not appear in any support/product source file.
const FORBIDDEN: { needle: string; why: string }[] = [
  { needle: "creator_addresses", why: "support must never query creator addresses" },
  { needle: "address_snapshot", why: "support must never read shipment address snapshots" },
  { needle: "token_hash", why: "support must never read raw/hashed request tokens" },
  { needle: "SUPABASE_SERVICE_ROLE_KEY", why: "support must never use the service role key" },
  { needle: "process.env.ANTHROPIC_MODEL", why: "§8 — support uses ANTHROPIC_SUPPORT_MODEL, not the Creator Score model" },
  { needle: "creator_score", why: "support must not read Creator Score data" },
];

test("support/product sources never reference operational PII or the scoring model", () => {
  for (const file of SUPPORT_SOURCES) {
    const src = readFileSync(file, "utf8");
    for (const { needle, why } of FORBIDDEN) {
      assert.ok(
        !src.includes(needle),
        `${file} contains "${needle}" — ${why}`,
      );
    }
  }
});

test("support assistant module holds no Supabase client", () => {
  const src = readFileSync("src/lib/anthropic/support-assistant.ts", "utf8");
  assert.ok(!src.includes("@supabase"), "the AI boundary must not import Supabase");
  assert.ok(!src.includes("createClient"), "the AI boundary takes articles as input, it does not fetch");
});

test("support env exposes ANTHROPIC_SUPPORT_MODEL as a separate knob (§8)", () => {
  const src = readFileSync("src/lib/anthropic/support-env.ts", "utf8");
  assert.ok(src.includes("ANTHROPIC_SUPPORT_MODEL"));
  assert.ok(!src.includes('process.env.ANTHROPIC_MODEL'));
});
