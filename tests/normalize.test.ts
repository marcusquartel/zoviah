import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isPlausibleHandle,
  normalizeEmail,
  normalizeHandle,
  normalizePhoneBR,
  parseCount,
  socialProfileUrl,
} from "../src/lib/normalize.ts";
import { slugify, fieldKeyify, isValidSlug } from "../src/lib/slug.ts";

test("normalizeEmail trims + lowercases, rejects blanks", () => {
  assert.equal(normalizeEmail("  Marcus@Example.COM "), "marcus@example.com");
  assert.equal(normalizeEmail(""), null);
  assert.equal(normalizeEmail("not-an-email"), null);
  assert.equal(normalizeEmail(undefined), null);
});

test("normalizeHandle strips @, URLs, case and slashes", () => {
  assert.equal(normalizeHandle("@Marcus"), "marcus");
  assert.equal(normalizeHandle("MARCUS"), "marcus");
  assert.equal(normalizeHandle("  marcus  "), "marcus");
  assert.equal(normalizeHandle("https://instagram.com/Marcus/"), "marcus");
  assert.equal(
    normalizeHandle("https://www.tiktok.com/@Marcus?lang=pt"),
    "marcus",
  );
  assert.equal(
    normalizeHandle("instagram.com/marcus.creator"),
    "marcus.creator",
  );
  assert.equal(normalizeHandle(""), null);
});

test("normalizeHandle: the same person compares equal", () => {
  const forms = ["@Marcus", "marcus", "MARCUS", "https://instagram.com/marcus"];
  const normalized = new Set(forms.map((f) => normalizeHandle(f)));
  assert.equal(normalized.size, 1);
  assert.equal([...normalized][0], "marcus");
});

test("normalizeHandle hardening: drops edge '.'/'_' and invalid chars, keeps valid usernames", () => {
  // the Phase 1 bug: "@quarteldesign." kept its trailing dot
  assert.equal(normalizeHandle("@quarteldesign."), "quarteldesign");
  assert.equal(normalizeHandle("_marcus_"), "marcus");
  assert.equal(normalizeHandle("..marcus.."), "marcus");
  // a dot in the middle is valid and must be preserved
  assert.equal(normalizeHandle("marcus.creator"), "marcus.creator");
  assert.equal(normalizeHandle("marcus_oficial"), "marcus_oficial");
  // '@' anywhere, spaces, and clearly-invalid chars are stripped
  assert.equal(normalizeHandle("mar cus"), "marcus");
  assert.equal(normalizeHandle("marcus!!!"), "marcus");
  assert.equal(normalizeHandle("maria@insta"), "mariainsta");
  // nothing left -> null
  assert.equal(normalizeHandle("...___..."), null);
  assert.equal(normalizeHandle("@@@"), null);
});

test("normalizeHandle caps length per platform", () => {
  const long = "a".repeat(60);
  assert.equal(normalizeHandle(long, "instagram")?.length, 30);
  assert.equal(normalizeHandle(long, "tiktok")?.length, 24);
  assert.equal(normalizeHandle(long)?.length, 60); // no platform -> uncapped
});

test("isPlausibleHandle soft-validates without rejecting submissions", () => {
  assert.equal(isPlausibleHandle("marcus.creator", "instagram"), true);
  assert.equal(isPlausibleHandle("ab", "tiktok"), true);
  assert.equal(isPlausibleHandle("a", "tiktok"), false); // too short for TikTok
  assert.equal(isPlausibleHandle("marcus..creator", "instagram"), false); // ".."
  assert.equal(isPlausibleHandle("a".repeat(31), "instagram"), false);
});

test("socialProfileUrl builds canonical URLs where known", () => {
  assert.equal(
    socialProfileUrl("instagram", "marcus"),
    "https://instagram.com/marcus",
  );
  assert.equal(
    socialProfileUrl("tiktok", "marcus"),
    "https://www.tiktok.com/@marcus",
  );
  assert.equal(socialProfileUrl("youtube", "marcus"), null);
  assert.equal(socialProfileUrl("instagram", null), null);
});

test("normalizePhoneBR: unambiguous digits only, else null", () => {
  assert.equal(normalizePhoneBR("+55 (11) 98888-7777"), "+5511988887777");
  assert.equal(normalizePhoneBR("11988887777"), "+5511988887777");
  assert.equal(normalizePhoneBR("1133334444"), "+551133334444");
  assert.equal(normalizePhoneBR("988887777"), null); // no DDD
  assert.equal(normalizePhoneBR("123"), null);
  assert.equal(normalizePhoneBR(""), null);
});

test("parseCount: pt-BR thousands separator — '137.000' is 137000, not 137", () => {
  assert.equal(parseCount("137.000"), 137000);
  assert.equal(parseCount("2.000"), 2000);
  assert.equal(parseCount("1.234.567"), 1234567);
  assert.equal(parseCount("137000"), 137000);
  assert.equal(parseCount("137,000"), 137000); // comma grouping too
});

test("parseCount: k / mil / mi suffixes, incl. decimal with a suffix", () => {
  assert.equal(parseCount("12k"), 12000);
  assert.equal(parseCount("137 mil"), 137000);
  assert.equal(parseCount("1,5mi"), 1500000);
  assert.equal(parseCount("1.5 mi"), 1500000);
  assert.equal(parseCount("3m"), 3000000);
});

test("parseCount: numbers pass through, junk and blanks are null", () => {
  assert.equal(parseCount(70000), 70000);
  assert.equal(parseCount(137000.9), 137000);
  assert.equal(parseCount(-5), null);
  assert.equal(parseCount(""), null);
  assert.equal(parseCount("  "), null);
  assert.equal(parseCount("abc"), null);
  assert.equal(parseCount("10 pessoas"), null);
  assert.equal(parseCount("01310-000"), null); // a CEP is not a count
});

test("slugify / fieldKeyify / isValidSlug", () => {
  assert.equal(slugify("Rare Creators!"), "rare-creators");
  assert.equal(slugify("  Programa Verão 2026  "), "programa-verao-2026");
  assert.equal(fieldKeyify("Seguidores no Instagram"), "seguidores_no_instagram");
  assert.equal(fieldKeyify("3 links"), "f_3_links");
  assert.equal(isValidSlug("rare-creators"), true);
  assert.equal(isValidSlug("Rare Creators"), false);
  assert.equal(isValidSlug("-bad-"), false);
});
