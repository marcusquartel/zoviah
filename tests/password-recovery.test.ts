import { test } from "node:test";
import assert from "node:assert/strict";
import {
  forgotPasswordSchema,
  passwordResetSchema,
} from "../src/lib/validation/auth.ts";
import {
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
  LOGIN_PATH,
  NEUTRAL_RESET_MESSAGE,
  RECOVERY_LINK_INVALID_MESSAGE,
} from "../src/features/auth/messages.ts";
import { buildAuthCallbackUrl } from "../src/lib/app-url.ts";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test("paths: stable and as the login link expects", () => {
  assert.equal(FORGOT_PASSWORD_PATH, "/forgot-password");
  assert.equal(RESET_PASSWORD_PATH, "/reset-password");
  assert.equal(LOGIN_PATH, "/login");
});

test("forgotPasswordSchema: trims a valid e-mail, rejects junk", () => {
  const ok = forgotPasswordSchema.safeParse({ email: "  User@Example.com " });
  assert.equal(ok.success, true);
  assert.equal(ok.data?.email, "User@Example.com");
  assert.equal(forgotPasswordSchema.safeParse({ email: "nope" }).success, false);
  assert.equal(forgotPasswordSchema.safeParse({ email: "" }).success, false);
});

test("passwordResetSchema: min 8, max 72, confirmation must match", () => {
  assert.equal(
    passwordResetSchema.safeParse({ password: "abcd1234", confirm: "abcd1234" })
      .success,
    true,
  );
  // too short
  assert.equal(
    passwordResetSchema.safeParse({ password: "short1", confirm: "short1" })
      .success,
    false,
  );
  // over bcrypt's 72-byte cap
  const long = "a".repeat(73);
  assert.equal(
    passwordResetSchema.safeParse({ password: long, confirm: long }).success,
    false,
  );
  // mismatch
  const mismatch = passwordResetSchema.safeParse({
    password: "abcd1234",
    confirm: "abcd9999",
  });
  assert.equal(mismatch.success, false);
  assert.match(
    mismatch.success ? "" : (mismatch.error.issues[0]?.message ?? ""),
    /não coincidem/i,
  );
});

test("neutral message never discloses account existence", () => {
  assert.match(NEUTRAL_RESET_MESSAGE, /se existir uma conta/i);
  for (const leak of [
    "não encontrado",
    "não existe",
    "e-mail inválido",
    "conta encontrada",
    "usuário não",
  ]) {
    assert.ok(
      !NEUTRAL_RESET_MESSAGE.toLowerCase().includes(leak),
      `neutral message leaks: ${leak}`,
    );
  }
  assert.match(RECOVERY_LINK_INVALID_MESSAGE, /inválido ou expirou/i);
});

test("buildAuthCallbackUrl: uses the central APP URL + a same-origin next", () => {
  withEnv({ NEXT_PUBLIC_APP_URL: "https://zoviah.app", NODE_ENV: "production" }, () => {
    assert.equal(
      buildAuthCallbackUrl(RESET_PASSWORD_PATH),
      "https://zoviah.app/auth/callback?next=%2Freset-password",
    );
  });
});

test("buildAuthCallbackUrl: rejects open-redirect targets, falls back to /app", () => {
  withEnv({ NEXT_PUBLIC_APP_URL: "https://zoviah.app", NODE_ENV: "production" }, () => {
    for (const evil of [
      "https://evil.example.com",
      "//evil.example.com",
      "javascript:alert(1)",
      "http://x",
    ]) {
      assert.equal(
        buildAuthCallbackUrl(evil),
        "https://zoviah.app/auth/callback?next=%2Fapp",
      );
    }
  });
});

test("buildAuthCallbackUrl: dev falls back to localhost base (no throw)", () => {
  withEnv({ NEXT_PUBLIC_APP_URL: undefined, APP_URL: undefined, NODE_ENV: "test" }, () => {
    assert.equal(
      buildAuthCallbackUrl(RESET_PASSWORD_PATH),
      "http://localhost:3001/auth/callback?next=%2Freset-password",
    );
  });
});
