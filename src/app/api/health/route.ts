import { NextResponse } from "next/server";

/**
 * Liveness probe for uptime monitoring. Deliberately tiny:
 *   - no database round-trip (a DB blip should not fail liveness);
 *   - no Anthropic call;
 *   - no environment values, names, or config detail.
 *
 * If the Node process can serve this route, the app is up.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { status: "ok", time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
