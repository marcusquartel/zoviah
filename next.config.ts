import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import { globalSecurityHeaders } from "./src/lib/security-headers";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Global security headers on every route. CSP ships Report-Only —
        // see src/lib/security-headers.ts and docs/production-readiness.md.
        source: "/:path*",
        headers: globalSecurityHeaders({
          isProduction,
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        }),
      },
      {
        // The token is a secret: never cache, never leak it in a Referer,
        // never index the page (Phase 4 §60). Overrides the global rules for
        // this path.
        source: "/complete/:token*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      {
        // Invite pages also carry a secret token in the URL.
        source: "/invite/:token*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      // Password-recovery surfaces: /auth/callback carries a one-time code in
      // the URL; /reset-password holds the recovery session; keep all three
      // uncached, unindexed and referrer-free.
      ...["/auth/callback", "/reset-password", "/forgot-password"].map(
        (source) => ({
          source,
          headers: [
            { key: "Cache-Control", value: "no-store, max-age=0" },
            { key: "Referrer-Policy", value: "no-referrer" },
            { key: "X-Robots-Tag", value: "noindex, nofollow" },
          ],
        }),
      ),
    ];
  },
};

// `withSentryConfig` is inert without SENTRY_* env vars: no source-map upload,
// no build failure. Runtime reporting is still gated on a DSN being present.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Only upload source maps when we actually have credentials to do so.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
