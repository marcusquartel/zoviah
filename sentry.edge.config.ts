// Sentry init for the Edge runtime (proxy / edge routes). No-op unless
// SENTRY_DSN is set.
import { initSentry } from "@/lib/observability/sentry-init";

initSentry("edge");
