/**
 * Pure helpers for the recovery / auth-callback surfaces. No I/O — unit-tested.
 */
import { RESET_PASSWORD_PATH, RECOVERY_ERRORS } from "./messages.ts";

/** e-mail OTP types Supabase can hand to `verifyOtp({ type, token_hash })`. */
const ALLOWED_OTP_TYPES = new Set([
  "recovery",
  "email",
  "magiclink",
  "invite",
  "signup",
  "email_change",
]);

export function isAllowedOtpType(raw: string | null): raw is string {
  return raw != null && ALLOWED_OTP_TYPES.has(raw);
}

/**
 * Constrain a post-verification redirect to a same-origin relative path.
 * Anything else (absolute URL, protocol-relative `//host`, `javascript:` …)
 * collapses to `/reset-password`, so `next` can never be an open redirect.
 */
export function safeNextPath(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")) {
    return raw;
  }
  return RESET_PASSWORD_PATH;
}

export interface AuthCallbackParams {
  tokenHash: string | null;
  type: string | null;
  code: string | null;
  next: string;
}

export function parseAuthCallback(sp: URLSearchParams): AuthCallbackParams {
  return {
    tokenHash: sp.get("token_hash"),
    type: sp.get("type"),
    code: sp.get("code"),
    next: safeNextPath(sp.get("next")),
  };
}

/**
 * Map a Supabase `verifyOtp` failure to a safe coarse code. Never returns the
 * raw message. Recognises "expired / already used" as its own bucket so the
 * (very likely) e-mail-prefetch case is visible in logs and the URL.
 */
export function classifyVerifyError(err: {
  message?: string;
  code?: string;
  status?: number;
} | null): string {
  if (!err) return RECOVERY_ERRORS.verifyFailed;
  const m = `${err.code ?? ""} ${err.message ?? ""}`.toLowerCase();
  if (
    m.includes("expired") ||
    m.includes("otp_expired") ||
    m.includes("already been used") ||
    m.includes("not found") ||
    m.includes("invalid token") ||
    m.includes("token has expired or is invalid")
  ) {
    return RECOVERY_ERRORS.otpExpired;
  }
  return RECOVERY_ERRORS.verifyFailed;
}

/**
 * Friendly message for a Supabase `updateUser({ password })` failure. Never
 * returns the raw message. `null` on the success path — the action redirects.
 */
export function mapUpdatePasswordError(
  err: { message?: string } | null,
): string | null {
  if (!err) return null;
  const m = (err.message ?? "").toLowerCase();
  if (m.includes("same") || m.includes("different from the old")) {
    return "A nova senha deve ser diferente da anterior.";
  }
  if (m.includes("weak") || m.includes("password")) {
    return "Senha muito fraca. Escolha uma senha mais forte.";
  }
  return "Não foi possível alterar a senha. Tente novamente.";
}
