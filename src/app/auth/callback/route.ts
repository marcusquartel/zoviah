import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import {
  isAllowedOtpType,
  parseAuthCallback,
} from "@/features/auth/callback";

/**
 * Supabase Auth e-mail links land here. A Route Handler is used deliberately —
 * it can write the auth cookies, a Server Component cannot.
 *
 * Two shapes are supported:
 *
 *  1. SSR e-mail OTP (the recovery flow): `?token_hash=...&type=recovery`
 *     -> `verifyOtp({ type, token_hash })`. Server-to-server, no URL fragment,
 *     no PKCE `code_verifier` needed — works even across devices.
 *
 *  2. PKCE / OAuth: `?code=...` -> `exchangeCodeForSession(code)`. Kept for
 *     forward-compatibility; no current flow relies on it.
 *
 * On a valid session we redirect to `next` (a same-origin relative path;
 * open-redirect targets are refused). On any failure we redirect to
 * `${next}?error=link` and let the target page show a generic message.
 *
 * `token_hash`, `code` and the full request URL are never logged.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const { tokenHash, type, code, next } = parseAuthCallback(url.searchParams);
  const fail = () =>
    NextResponse.redirect(new URL(`${next}?error=link`, url.origin));

  try {
    const supabase = await createClient();

    if (tokenHash && isAllowedOtpType(type)) {
      const { error } = await supabase.auth.verifyOtp({
        type: type as EmailOtpType,
        token_hash: tokenHash,
      });
      if (error) {
        console.error("[auth/callback] verifyOtp rejected:", error.status ?? "");
        return fail();
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.error("[auth/callback] code exchange rejected");
        return fail();
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
  } catch {
    console.error("[auth/callback] verification threw");
    return fail();
  }

  // Neither shape present.
  return fail();
}
