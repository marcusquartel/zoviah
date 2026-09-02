import { test } from "node:test";
import assert from "node:assert/strict";
import {
  brLocationKind,
  buildFieldSchema,
  coerceFieldType,
  defaultFormValues,
  mappingsForFieldType,
  type PublicFieldDef,
} from "../src/lib/form-fields.ts";

function field(over: Partial<PublicFieldDef>): PublicFieldDef {
  return {
    field_key: "f",
    label: "F",
    field_type: "text",
    placeholder: null,
    help_text: null,
    required: false,
    options: null,
    configuration: null,
    position: 0,
    ...over,
  };
}

const consentOk = { _consent: true as const, _hp: "" };

test("required text is enforced; optional text allows empty", () => {
  const reqSchema = buildFieldSchema([
    field({ field_key: "name", field_type: "text", required: true }),
  ]);
  assert.equal(reqSchema.safeParse({ name: "", ...consentOk }).success, false);
  assert.equal(reqSchema.safeParse({ name: "Ana", ...consentOk }).success, true);

  const optSchema = buildFieldSchema([
    field({ field_key: "nick", field_type: "text", required: false }),
  ]);
  assert.equal(optSchema.safeParse({ nick: "", ...consentOk }).success, true);
});

test("email / url / number / date formats validated", () => {
  const schema = buildFieldSchema([
    field({ field_key: "mail", field_type: "email", required: true }),
    field({ field_key: "link", field_type: "url", required: false }),
    field({ field_key: "n", field_type: "number", required: true }),
    field({ field_key: "d", field_type: "date", required: false }),
  ]);
  assert.equal(
    schema.safeParse({ mail: "x", link: "", n: "10", d: "", ...consentOk }).success,
    false,
  );
  assert.equal(
    schema.safeParse({
      mail: "a@b.com",
      link: "noturl",
      n: "10",
      d: "",
      ...consentOk,
    }).success,
    false,
  );
  assert.equal(
    schema.safeParse({
      mail: "a@b.com",
      link: "https://x.com",
      n: "abc",
      d: "",
      ...consentOk,
    }).success,
    false,
  );
  assert.equal(
    schema.safeParse({
      mail: "a@b.com",
      link: "https://x.com",
      n: "10",
      d: "2000-05-01",
      ...consentOk,
    }).success,
    true,
  );
});

test("single_select enforces option membership", () => {
  const schema = buildFieldSchema([
    field({
      field_key: "topic",
      field_type: "single_select",
      required: true,
      options: [
        { value: "beauty", label: "Beleza" },
        { value: "fitness", label: "Fitness" },
      ],
    }),
  ]);
  assert.equal(schema.safeParse({ topic: "beauty", ...consentOk }).success, true);
  assert.equal(schema.safeParse({ topic: "other", ...consentOk }).success, false);
  assert.equal(schema.safeParse({ topic: "", ...consentOk }).success, false);
});

test("multi_select: array, membership, required min 1", () => {
  const schema = buildFieldSchema([
    field({
      field_key: "topics",
      field_type: "multi_select",
      required: true,
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
      ],
    }),
  ]);
  assert.equal(schema.safeParse({ topics: ["a", "b"], ...consentOk }).success, true);
  assert.equal(schema.safeParse({ topics: [], ...consentOk }).success, false);
  assert.equal(schema.safeParse({ topics: ["z"], ...consentOk }).success, false);
});

test("consent + honeypot", () => {
  const schema = buildFieldSchema([field({ field_key: "x" })]);
  assert.equal(schema.safeParse({ x: "", _consent: true, _hp: "" }).success, true);
  assert.equal(schema.safeParse({ x: "", _consent: false, _hp: "" }).success, false);
  // honeypot filled => rejected
  assert.equal(
    schema.safeParse({ x: "", _consent: true, _hp: "i am a bot" }).success,
    false,
  );
  // consent not required when disabled
  const noConsent = buildFieldSchema([field({ field_key: "x" })], {
    consent: false,
  });
  assert.equal(noConsent.safeParse({ x: "" }).success, true);
});

test("defaultFormValues + mappingsForFieldType", () => {
  const values = defaultFormValues([
    field({ field_key: "t", field_type: "text" }),
    field({ field_key: "m", field_type: "multi_select" }),
    field({ field_key: "c", field_type: "checkbox" }),
  ]);
  assert.deepEqual(values, {
    _consent: false,
    _hp: "",
    t: "",
    m: [],
    c: false,
  });
  assert.deepEqual(mappingsForFieldType("email"), ["email"]);
  assert.deepEqual(mappingsForFieldType("instagram"), ["instagram"]);
  assert.deepEqual(mappingsForFieldType("textarea"), []);
});

test("br_state: required enforces a real UF; uppercases input", () => {
  const schema = buildFieldSchema([
    field({ field_key: "uf", field_type: "br_state", required: true }),
  ]);
  assert.equal(schema.safeParse({ uf: "SP", ...consentOk }).success, true);
  assert.equal(schema.safeParse({ uf: "sp", ...consentOk }).success, true); // normalised
  assert.equal(schema.safeParse({ uf: "", ...consentOk }).success, false);
  assert.equal(schema.safeParse({ uf: "XX", ...consentOk }).success, false);

  const opt = buildFieldSchema([
    field({ field_key: "uf", field_type: "br_state", required: false }),
  ]);
  assert.equal(opt.safeParse({ uf: "", ...consentOk }).success, true);
  assert.equal(opt.safeParse({ uf: "ZZ", ...consentOk }).success, false);
});

test("br_city: required enforces non-empty, caps length", () => {
  const schema = buildFieldSchema([
    field({ field_key: "city", field_type: "br_city", required: true }),
  ]);
  assert.equal(
    schema.safeParse({ city: "São Paulo", ...consentOk }).success,
    true,
  );
  assert.equal(schema.safeParse({ city: "", ...consentOk }).success, false);
  assert.equal(
    schema.safeParse({ city: "x".repeat(121), ...consentOk }).success,
    false,
  );
});

test("mappingsForFieldType: br_state/br_city auto-map to state/city", () => {
  assert.deepEqual(mappingsForFieldType("br_state"), ["state"]);
  assert.deepEqual(mappingsForFieldType("br_city"), ["city"]);
});

test("brLocationKind: a legacy text field mapped to state/city is still a list", () => {
  assert.equal(
    brLocationKind({ field_type: "text", configuration: { mapping: "state" } }),
    "state",
  );
  assert.equal(
    brLocationKind({ field_type: "text", configuration: { mapping: "city" } }),
    "city",
  );
  assert.equal(brLocationKind({ field_type: "br_state", configuration: null }), "state");
  assert.equal(brLocationKind({ field_type: "br_city", configuration: null }), "city");
  assert.equal(
    brLocationKind({ field_type: "text", configuration: { mapping: "full_name" } }),
    null,
  );
});

test("a legacy text field mapped to state validates as a UF", () => {
  const schema = buildFieldSchema([
    field({
      field_key: "uf",
      field_type: "text",
      required: true,
      configuration: { mapping: "state" },
    }),
  ]);
  assert.equal(schema.safeParse({ uf: "mg", ...consentOk }).success, true);
  assert.equal(schema.safeParse({ uf: "Minas Gerais", ...consentOk }).success, false);
});

test("coerceFieldType: a state/city mapping forces the controlled type", () => {
  assert.equal(coerceFieldType("text", "state"), "br_state");
  assert.equal(coerceFieldType("text", "city"), "br_city");
  assert.equal(coerceFieldType("text", "full_name"), "text");
  assert.equal(coerceFieldType("email", undefined), "email");
});
