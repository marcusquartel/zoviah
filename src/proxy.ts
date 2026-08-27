import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Next.js "proxy" (formerly middleware). Single entry point per project.
 */
export async function proxy(request: NextRequest) {
  // Public program pages (/p/...) are unauthenticated by design — skip the
  // session round-trip entirely.
  if (request.nextUrl.pathname.startsWith("/p/")) {
    return NextResponse.next();
  }
  // Without credentials there is no session to manage; let every route render
  // its own "configure Supabase" notice instead of crashing here.
  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  /*
   * Run on all paths except static assets and image optimization. Auth flows
   * benefit from the proxy running broadly.
   */
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
