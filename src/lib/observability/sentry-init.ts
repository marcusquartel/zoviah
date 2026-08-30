/**
 * Shared Sentry initialisation for every runtime (server, edge, browser).
 *
 * - DSN comes ONLY from the environment (`SENTRY_DSN` server-side,
 *   `NEXT_PUBLIC_SENTRY_DSN` for the browser). Never hard-coded.
 * - When no DSN is set, `Sentry.init` is not called at all — the SDK stays a
 *   no-op, so a dev / CI run without Sentry configured behaves exactly as
 *   before.
 * - `sendDefaultPii: false` and a `beforeSend` scrubber (see `scrub.ts`) keep
 *   personal data and secrets out of every event.
 */
import * as Sentry from "@sentry/nextjs";
import { scrubEvent } from "./scrub";

type Runtime = "server" | "edge" | "client";

export function initSentry(runtime: Runtime): void {
  const dsn =
    runtime === "client"
      ? process.env.NEXT_PUBLIC_SENTRY_DSN
      : process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_APP_RELEASE || undefined,
    // Low-volume tracing; raise deliberately if needed.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? "0.05"),
    sendDefaultPii: false,
    beforeSend(event) {
      return scrubEvent(
        event as unknown as Record<string, unknown>,
      ) as unknown as typeof event;
    },
    beforeSendTransaction(event) {
      return scrubEvent(
        event as unknown as Record<string, unknown>,
      ) as unknown as typeof event;
    },
  });
}

/** True when error monitoring is actually wired for this runtime. */
export function isSentryEnabled(runtime: Runtime): boolean {
  return runtime === "client"
    ? Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)
    : Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}
