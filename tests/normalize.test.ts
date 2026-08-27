import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEmail,
  normalizeHandle,
  normalizePhoneBR,
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
  assert.equal(normalizeHandle("https://www.tiktok.com/@Marcus?lang=pt"), "marcus");
  assert.equal(normalizeHandle("instagram.com/marcus.creator"), "marcus.creator");
  assert.equal(normalizeHandle(""), null);
});

test("normalizeHandle: the same person compares equal", () => {
  const forms = ["@Marcus", "marcus", "MARCUS", "https://instagram.com/marcus"];
  const normalized = new Set(forms.map(normalizeHandle));
  assert.equal(normalized.size, 1);
  assert.equal([...normalized][0], "marcus");
});

test("socialProfileUrl builds canonical URLs where known", () => {
  assert.equal(socialProfileUrl("instagram", "marcus"), "https://instagram.com/marcus");
  assert.equal(socialProfileUrl("tiktok", "marcus"), "https://www.tiktok.com/@marcus");
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

test("slugify / fieldKeyify / isValidSlug", () => {
  assert.equal(slugify("Rare Creators!"), "rare-creators");
  assert.equal(slugify("  Programa Verão 2026  "), "programa-verao-2026");
  assert.equal(fieldKeyify("Seguidores no Instagram"), "seguidores_no_instagram");
  assert.equal(fieldKeyify("3 links"), "f_3_links");
  assert.equal(isValidSlug("rare-creators"), true);
  assert.equal(isValidSlug("Rare Creators"), false);
  assert.equal(isValidSlug("-bad-"), false);
});
