import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/observability/sentry-init";
import { isDebugRouteEnabled } from "@/lib/observability/debug-route";

/**
 * Deliberately throws so the error-monitoring pipeline can be verified end to
 * end. Documented in `docs/production-readiness.md`.
 *
 * Abuse guard: in production this route does not exist (404) unless
 * `ENABLE_SENTRY_DEBUG_ROUTE=1` is explicitly set. That keeps an anonymous
 * visitor from generating exceptions and burning Sentry quota. Outside
 * production it works with `?confirm=1`. Turn the flag on only while checking
 * the integration, then remove it.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isDebugRouteEnabled(process.env)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const confirmed = new URL(request.url).searchParams.get("confirm") === "1";
  if (!confirmed) {
    return NextResponse.json({
      status: "ready",
      sentryConfigured: isSentryEnabled("server"),
      hint: "append ?confirm=1 to trigger a test exception",
    });
  }

  if (!isSentryEnabled("server")) {
    return NextResponse.json({
      status: "skipped",
      reason: "SENTRY_DSN not set — nothing to send",
    });
  }

  const err = new Error(
    `Sentry test exception (deliberate) @ ${new Date().toISOString()}`,
  );
  Sentry.captureException(err);
  await Sentry.flush(2000);
  throw err;
}
