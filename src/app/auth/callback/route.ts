import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RESET_PASSWORD_PATH } from "@/features/auth/messages";

/**
 * Supabase Auth redirects here after verifying a recovery (or other e-mail)
 * link. We exchange the one-time `code` for a session — a Route Handler can
 * write the auth cookies, a Server Component cannot — then forward to `next`.
 *
 * Security: `next` is constrained to a same-origin relative path (no open
 * redirect); the `code` and the full URL are never logged.
 */
export const dynamic = "force-dynamic";

function safeNext(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return RESET_PASSWORD_PATH;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL(next, url.origin));
      }
      console.error("[auth/callback] code exchange rejected");
    } catch {
      console.error("[auth/callback] code exchange threw");
    }
  }

  // No code, or exchange failed → let the target page show the invalid state.
  return NextResponse.redirect(new URL(`${next}?error=link`, url.origin));
}
