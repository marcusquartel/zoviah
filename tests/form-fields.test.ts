import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildFieldSchema,
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
