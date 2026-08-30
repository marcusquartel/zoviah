// Sentry init for the Node.js server runtime. No-op unless SENTRY_DSN is set.
import { initSentry } from "@/lib/observability/sentry-init";

initSentry("server");
