import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseAuthCallback } from "@/features/auth/callback";
import { RECOVERY_ERRORS, RECOVER_CONFIRM_PATH } from "@/features/auth/messages";

/**
 * Supabase Auth e-mail links land here.
 *
 *  1. `?token_hash=...&type=...` (SSR e-mail OTP, incl. recovery):
 *     we DO NOT verify on this GET — an e-mail scanner that pre-opens the link
 *     would burn the single-use OTP and the human's click would then fail with
 *     `otp_expired`. Instead we forward to /recover/confirm, where an explicit
 *     button POSTs and consumes the token.
 *
 *  2. `?code=...` (PKCE / OAuth): exchanged here. No current flow relies on it;
 *     kept for forward-compatibility.
 *
 * `next` is constrained to a same-origin relative path; token_hash / code /
 * full URL are never logged.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { tokenHash, type, code, next } = parseAuthCallback(url.searchParams);

  // Prefetch-safe: hand the OTP to the confirmation page, don't consume it.
  if (tokenHash) {
    const to = new URL(RECOVER_CONFIRM_PATH, url.origin);
    to.searchParams.set("token_hash", tokenHash);
    if (type) to.searchParams.set("type", type);
    to.searchParams.set("next", next);
    return NextResponse.redirect(to);
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, url.origin));
      console.error("[auth/callback] code exchange rejected", {
        flow: "oauth",
        at: new Date().toISOString(),
      });
    } catch {
      console.error("[auth/callback] code exchange threw");
    }
    return NextResponse.redirect(
      new URL(`${next}?error=${RECOVERY_ERRORS.verifyFailed}`, url.origin),
    );
  }

  return NextResponse.redirect(
    new URL(`${next}?error=${RECOVERY_ERRORS.missingToken}`, url.origin),
  );
}
