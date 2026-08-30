// Sentry init for the browser. No-op unless NEXT_PUBLIC_SENTRY_DSN is set.
import { initSentry } from "@/lib/observability/sentry-init";
import * as Sentry from "@sentry/nextjs";

initSentry("client");

// Required by @sentry/nextjs for navigation instrumentation; harmless when
// Sentry is not initialised.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
