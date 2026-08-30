import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { isSentryEnabled } from "@/lib/observability/sentry-init";

/**
 * Deliberately throws so you can verify the error-monitoring pipeline end to
 * end. Documented in `docs/production-readiness.md`.
 *
 * Guarded by `?confirm=1` so a crawler or a stray click doesn't spam the
 * issue tracker. Returns a plain 200 (not an error) when Sentry is not
 * configured, so hitting it in dev is harmless and obvious.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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
