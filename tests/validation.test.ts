import { test } from "node:test";
import assert from "node:assert/strict";
import { loginSchema } from "../src/lib/validation/auth.ts";
import { appearanceSchema } from "../src/lib/validation/appearance.ts";

test("loginSchema accepts a valid credential pair", () => {
  const result = loginSchema.safeParse({
    email: "  user@example.com ",
    password: "secret",
  });
  assert.equal(result.success, true);
  assert.equal(result.data?.email, "user@example.com"); // trimmed
});

test("loginSchema rejects a bad email or empty password", () => {
  assert.equal(
    loginSchema.safeParse({ email: "nope", password: "x" }).success,
    false,
  );
  assert.equal(
    loginSchema.safeParse({ email: "user@example.com", password: "" }).success,
    false,
  );
});

test("appearanceSchema allows empty strings (clear) and valid hex", () => {
  assert.equal(
    appearanceSchema.safeParse({ primaryColor: "", secondaryColor: "" }).success,
    true,
  );
  assert.equal(
    appearanceSchema.safeParse({
      primaryColor: "#4F46E5",
      secondaryColor: "#abc",
    }).success,
    true,
  );
});

test("appearanceSchema rejects non-hex input", () => {
  assert.equal(
    appearanceSchema.safeParse({
      primaryColor: "rebeccapurple",
      secondaryColor: "",
    }).success,
    false,
  );
});
