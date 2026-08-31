import { test } from "node:test";
import assert from "node:assert/strict";
import {
  forgotPasswordSchema,
  passwordResetSchema,
} from "../src/lib/validation/auth.ts";
import {
  FORGOT_PASSWORD_PATH,
  RESET_PASSWORD_PATH,
  RECOVER_CONFIRM_PATH,
  LOGIN_PATH,
  NEUTRAL_RESET_MESSAGE,
  RECOVERY_LINK_INVALID_MESSAGE,
  RECOVERY_ERRORS,
  RECOVERY_ERROR_MESSAGES,
  recoveryErrorMessage,
} from "../src/features/auth/messages.ts";
import { buildAuthCallbackUrl } from "../src/lib/app-url.ts";
import {
  isAllowedOtpType,
  safeNextPath,
  parseAuthCallback,
  classifyVerifyError,
} from "../src/features/auth/callback.ts";

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
  assert.equal(RECOVER_CONFIRM_PATH, "/recover/confirm");
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

// --- /auth/callback SSR handler helpers --------------------------------------

test("isAllowedOtpType: recovery + the standard e-mail OTP types, nothing else", () => {
  for (const t of ["recovery", "email", "magiclink", "invite", "signup", "email_change"]) {
    assert.equal(isAllowedOtpType(t), true, t);
  }
  for (const t of ["", "sms", "phone", "oauth", "RECOVERY", "recovery ", null]) {
    assert.equal(isAllowedOtpType(t as string | null), false, String(t));
  }
});

test("safeNextPath: same-origin relative only; everything else -> /reset-password", () => {
  assert.equal(safeNextPath("/reset-password"), "/reset-password");
  assert.equal(safeNextPath("/app/creators"), "/app/creators");
  for (const evil of [
    null,
    "",
    "reset-password",
    "//evil.example.com",
    "/\\evil.example.com",
    "https://evil.example.com",
    "http://x",
    "javascript:alert(1)",
    "\\\\evil",
  ]) {
    assert.equal(safeNextPath(evil), "/reset-password", String(evil));
  }
});

test("classifyVerifyError: expired / used / not-found -> otp_expired bucket", () => {
  for (const m of [
    "Token has expired or is invalid",
    "otp_expired",
    "Email link is invalid or has expired",
    "Token has expired",
    "OTP has already been used",
    "user not found",
  ]) {
    assert.equal(
      classifyVerifyError({ message: m }),
      RECOVERY_ERRORS.otpExpired,
      m,
    );
  }
  assert.equal(
    classifyVerifyError({ code: "otp_expired", status: 403 }),
    RECOVERY_ERRORS.otpExpired,
  );
});

test("classifyVerifyError: anything else / null -> verify_failed (never raw text)", () => {
  assert.equal(
    classifyVerifyError({ message: "Database connection lost" }),
    RECOVERY_ERRORS.verifyFailed,
  );
  assert.equal(classifyVerifyError(null), RECOVERY_ERRORS.verifyFailed);
  // the returned value is always one of the safe codes
  for (const v of Object.values(RECOVERY_ERRORS)) assert.equal(typeof v, "string");
});

test("recoveryErrorMessage: safe generic copy per code, no Supabase text", () => {
  assert.match(
    recoveryErrorMessage(RECOVERY_ERRORS.otpExpired),
    /expirou ou já foi usado/i,
  );
  assert.match(
    recoveryErrorMessage(RECOVERY_ERRORS.cookieFailed),
    /iniciar a sessão de recuperação/i,
  );
  // unknown / missing -> the plain invalid message
  assert.equal(recoveryErrorMessage("bogus_code"), RECOVERY_LINK_INVALID_MESSAGE);
  assert.equal(recoveryErrorMessage(null), RECOVERY_LINK_INVALID_MESSAGE);
  // no message leaks a token / e-mail / "supabase"
  for (const msg of Object.values(RECOVERY_ERROR_MESSAGES)) {
    assert.doesNotMatch(msg, /token_hash|supabase|jwt|@|\berror\b/i);
  }
});

test("parseAuthCallback: extracts token_hash/type/code, sanitises next", () => {
  const recovery = parseAuthCallback(
    new URLSearchParams("token_hash=abc123&type=recovery&next=/reset-password"),
  );
  assert.deepEqual(recovery, {
    tokenHash: "abc123",
    type: "recovery",
    code: null,
    next: "/reset-password",
  });

  const pkce = parseAuthCallback(
    new URLSearchParams("code=xyz&next=https://evil.example.com"),
  );
  assert.equal(pkce.code, "xyz");
  assert.equal(pkce.tokenHash, null);
  assert.equal(pkce.next, "/reset-password"); // open-redirect target dropped

  const empty = parseAuthCallback(new URLSearchParams(""));
  assert.deepEqual(empty, {
    tokenHash: null,
    type: null,
    code: null,
    next: "/reset-password",
  });
});
