import { test } from "node:test";
import assert from "node:assert/strict";
import { BR_STATES, BR_UFS } from "../src/lib/br-locations.ts";
import { BR_CITIES, citiesForUf, isBrCity } from "../src/lib/br-cities.ts";

test("BR_STATES: 27 federative units, unique 2-letter UFs", () => {
  assert.equal(BR_STATES.length, 27);
  assert.equal(new Set(BR_UFS).size, 27);
  assert.ok(BR_UFS.every((uf) => /^[A-Z]{2}$/.test(uf)));
});

test("BR_CITIES: full IBGE list, every row belongs to a known UF", () => {
  // IBGE currently publishes 5570 municipalities (+ Fernando de Noronha as a
  // district of PE in some datasets). Guard a sane range rather than an exact
  // count so a future IBGE revision doesn't break the suite.
  assert.ok(
    BR_CITIES.length >= 5560 && BR_CITIES.length <= 5600,
    `unexpected city count ${BR_CITIES.length}`,
  );
  const ufs = new Set(BR_UFS as readonly string[]);
  assert.ok(BR_CITIES.every((c) => ufs.has(c.uf)));
  // every UF has at least one municipality
  for (const uf of BR_UFS) {
    assert.ok(citiesForUf(uf).length > 0, `no cities for ${uf}`);
  }
});

test("citiesForUf / isBrCity: known lookups", () => {
  assert.ok(citiesForUf("SP").includes("São Paulo"));
  assert.ok(citiesForUf("MG").includes("Belo Horizonte"));
  assert.ok(citiesForUf("RJ").includes("Rio de Janeiro"));
  // case / accent tolerant
  assert.equal(isBrCity("são paulo", "SP"), true);
  assert.equal(isBrCity("SÃO PAULO", "sp"), true);
  // wrong UF
  assert.equal(isBrCity("São Paulo", "RJ"), false);
  assert.equal(isBrCity("Cidade Inventada", "SP"), false);
});
