/**
 * Pure helpers for the /auth/callback route handler. No I/O — unit-tested.
 */
import { RESET_PASSWORD_PATH } from "./messages.ts";

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
 * Constrain the post-verification redirect to a same-origin relative path.
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
  /** Present for the SSR e-mail OTP flow (recovery, magic link, invite …). */
  tokenHash: string | null;
  type: string | null;
  /** Present for the PKCE / OAuth code-exchange flow. */
  code: string | null;
  /** Always a safe same-origin relative path. */
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
