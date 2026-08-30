import * as Sentry from "@sentry/nextjs";

/**
 * Loads the per-runtime Sentry config. Both files are no-ops unless a DSN is
 * present in the environment, so this is safe to keep wired unconditionally.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Reports React Server Component / route-handler errors to Sentry (no-op when
// Sentry is not initialised).
export const onRequestError = Sentry.captureRequestError;
