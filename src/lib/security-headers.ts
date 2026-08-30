/**
 * Global HTTP security headers, applied in `next.config.ts`.
 *
 * The Content-Security-Policy ships **Report-Only** first: the app renders
 * tenant-supplied logo URLs (any https host), talks to Supabase over
 * https + wss, and serves Next's own inline bootstrap. A blocking policy is
 * only safe after these are proven in the wild — see
 * `docs/production-readiness.md` for the enforce cut-over.
 */

export interface HeaderRule {
  key: string;
  value: string;
}

/**
 * Build the CSP string.
 *
 * @param supabaseUrl  the project URL, so its origin (and wss variant) can be
 *                     allow-listed for `connect-src`.
 */
export function buildContentSecurityPolicy(supabaseUrl: string | undefined): string {
  const connect = new Set<string>(["'self'"]);
  if (supabaseUrl) {
    try {
      const u = new URL(supabaseUrl);
      connect.add(u.origin);
      connect.add(`wss://${u.host}`);
    } catch {
      /* ignore a malformed URL — connect-src stays 'self' only */
    }
  }

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Next.js injects an inline runtime bootstrap; 'unsafe-inline' for scripts
    // is required until a nonce pipeline is added. Revisit at enforce time.
    "script-src": ["'self'", "'unsafe-inline'"],
    "style-src": ["'self'", "'unsafe-inline'"],
    // Tenant logos / favicons are arbitrary https URLs set by the operator.
    "img-src": ["'self'", "https:", "data:", "blob:"],
    "font-src": ["'self'", "data:"],
    "connect-src": [...connect],
    "frame-ancestors": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "object-src": ["'none'"],
  };

  return Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");
}

/**
 * The static header set (everything except CSP). HSTS is only meaningful over
 * HTTPS, so it is gated on production.
 */
export function baseSecurityHeaders(opts: { isProduction: boolean }): HeaderRule[] {
  const rules: HeaderRule[] = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
    },
    { key: "X-DNS-Prefetch-Control", value: "off" },
  ];
  if (opts.isProduction) {
    rules.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }
  return rules;
}

/** Full header list for a global `headers()` entry in next.config. */
export function globalSecurityHeaders(opts: {
  isProduction: boolean;
  supabaseUrl: string | undefined;
}): HeaderRule[] {
  return [
    ...baseSecurityHeaders(opts),
    {
      // Report-Only until validated — see module docstring.
      key: "Content-Security-Policy-Report-Only",
      value: buildContentSecurityPolicy(opts.supabaseUrl),
    },
  ];
}
