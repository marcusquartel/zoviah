import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addressSchema,
  toAddressPayload,
} from "../src/lib/validation/address.ts";
import { getAppBaseUrl, buildSecureLinkUrl } from "../src/lib/app-url.ts";

const base = {
  recipientName: "  Pâmela Kald  ",
  cpf: "111.444.777-35",
  postalCode: "30140-110",
  street: "Rua dos Aimorés",
  number: "123",
  complement: "",
  neighborhood: "Funcionários",
  city: "Belo Horizonte",
  state: "mg",
  consent: true as const,
};

test("address: CEP with mask -> 8 digits; UF lowercased -> upper; strings trimmed", () => {
  const r = addressSchema.parse(base);
  assert.equal(r.postalCode, "30140110");
  assert.equal(r.state, "MG");
  assert.equal(r.recipientName, "Pâmela Kald");
});

test("address: unknown / empty UF is rejected", () => {
  assert.equal(addressSchema.safeParse({ ...base, state: "XX" }).success, false);
  assert.equal(addressSchema.safeParse({ ...base, state: "" }).success, false);
});

test("address: CEP without mask passes through", () => {
  assert.equal(addressSchema.parse({ ...base, postalCode: "30140110" }).postalCode, "30140110");
});

test("address: CEP with wrong digit count is rejected", () => {
  assert.equal(addressSchema.safeParse({ ...base, postalCode: "12345" }).success, false);
  assert.equal(addressSchema.safeParse({ ...base, postalCode: "123456789" }).success, false);
});

test("address: empty required field (after trim) is rejected", () => {
  for (const k of ["recipientName", "street", "number", "neighborhood", "city"] as const) {
    assert.equal(
      addressSchema.safeParse({ ...base, [k]: "   " }).success,
      false,
      `${k} blank must fail`,
    );
  }
});

test("address: over-long field is rejected", () => {
  assert.equal(
    addressSchema.safeParse({ ...base, street: "x".repeat(201) }).success,
    false,
  );
  assert.equal(
    addressSchema.safeParse({ ...base, recipientName: "y".repeat(151) }).success,
    false,
  );
});

test("address: bad UF rejected", () => {
  assert.equal(addressSchema.safeParse({ ...base, state: "minas" }).success, false);
  assert.equal(addressSchema.safeParse({ ...base, state: "m" }).success, false);
});

test("address: a real UF passes (sp lowercase)", () => {
  assert.equal(addressSchema.parse({ ...base, state: "sp" }).state, "SP");
});

test("address: consent must be true", () => {
  assert.equal(
    addressSchema.safeParse({ ...base, consent: false }).success,
    false,
  );
});

test("address: complement is optional, defaults to ''", () => {
  const r = addressSchema.parse({ ...base });
  assert.equal(r.complement, "");
});

test("toAddressPayload: snake_case for the RPC, null complement, digits-only cpf", () => {
  const p = toAddressPayload(addressSchema.parse(base));
  assert.deepEqual(p, {
    recipient_name: "Pâmela Kald",
    cpf: "11144477735",
    postal_code: "30140110",
    street: "Rua dos Aimorés",
    number: "123",
    complement: null,
    neighborhood: "Funcionários",
    city: "Belo Horizonte",
    state: "MG",
    consent: true,
  });
});

test("address: CPF is required and structurally validated", () => {
  assert.equal(addressSchema.parse(base).cpf, "11144477735");
  assert.equal(addressSchema.safeParse({ ...base, cpf: "" }).success, false);
  assert.equal(
    addressSchema.safeParse({ ...base, cpf: "111.444.777-00" }).success,
    false,
  );
  assert.equal(
    addressSchema.safeParse({ ...base, cpf: "111111111 11" }).success,
    false,
  );
});

test("app-url: dev default is localhost:3001, link is built under /complete", () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.NEXT_PUBLIC_APP_URL;
  assert.equal(getAppBaseUrl(), "http://localhost:3001");
  assert.equal(
    buildSecureLinkUrl("AbC-123_xyz"),
    "http://localhost:3001/complete/AbC-123_xyz",
  );
  if (prev !== undefined) process.env.NEXT_PUBLIC_APP_URL = prev;
});

test("app-url: configured value wins and trailing slash is trimmed", () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://hub.example.com/";
  assert.equal(getAppBaseUrl(), "https://hub.example.com");
  if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = prev;
});

test("app-url: invalid value throws", () => {
  const prev = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "not a url";
  assert.throws(() => getAppBaseUrl());
  if (prev === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = prev;
});
