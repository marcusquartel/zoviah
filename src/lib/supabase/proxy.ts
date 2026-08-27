import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

const LOGIN_PATH = "/login";
const APP_PREFIX = "/app";

/**
 * Runs on every request (see src/proxy.ts). It does two things:
 *
 *  1. Refreshes the Supabase auth cookies so Server Components always see a
 *     valid session.
 *  2. Performs an *optimistic* redirect based only on the cookie:
 *     unauthenticated users are pushed off `/app`, authenticated users are
 *     pushed off `/login`.
 *
 * This is not the security boundary — every `/app` route and every query also
 * verifies the user server-side, and the database enforces tenant isolation
 * through RLS. The proxy is just a fast redirect.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, anonKey } = getSupabaseEnv();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && pathname.startsWith(APP_PREFIX)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = LOGIN_PATH;
    return NextResponse.redirect(redirectUrl);
  }

  if (user && pathname === LOGIN_PATH) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = APP_PREFIX;
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
