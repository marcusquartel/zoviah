/**
 * Host → tenant resolution (Phase 8A).
 *
 * `<slug>.zoviah.app` selects an organization CONTEXT. It never grants
 * authorization — membership is still checked server-side and RLS is still the
 * last barrier. This module is pure and unit-tested.
 *
 *   zoviah.app              -> root
 *   www.zoviah.app          -> root
 *   <anything>.vercel.app   -> root  (preview / the bare project domain)
 *   localhost[:port]        -> root
 *   127.0.0.1 / [::1] / IPs -> root
 *   rareway.zoviah.app      -> tenant, slug "rareway"
 *   rare-way.localhost:3001 -> tenant, slug "rare-way"  (local testing, opt-in)
 *   a.b.zoviah.app          -> unknown (not a single tenant label)
 */

export type HostContext =
  | { kind: "root" }
  | { kind: "tenant"; slug: string }
  | { kind: "unknown" };

/** Labels that can never be a tenant slug even if the slug format allows them. */
export const RESERVED_SUBDOMAINS: ReadonlySet<string> = new Set([
  "www",
  "app",
  "admin",
  "api",
  "auth",
  "static",
  "assets",
  "cdn",
  "img",
  "images",
  "media",
  "mail",
  "email",
  "smtp",
  "ftp",
  "ns",
  "ns1",
  "ns2",
  "dns",
  "vpn",
  "status",
  "docs",
  "blog",
  "help",
  "support",
  "dashboard",
  "billing",
  "internal",
  "test",
  "staging",
  "dev",
  "preview",
]);

/** Same rule as `organizations.slug` (a valid DNS label under 64 chars). */
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isIpv4(h: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(h);
}

/** Strip a `:port`, lower-case, drop a trailing dot, unwrap `[ipv6]`. */
export function normalizeHost(raw: string | null | undefined): string {
  const h = (raw ?? "").trim().toLowerCase().replace(/\.$/, "");
  if (h.startsWith("[")) {
    // bracketed IPv6, optionally `]:port`
    const end = h.indexOf("]");
    return end > 0 ? h.slice(1, end) : h.slice(1);
  }
  return h.split(":")[0];
}

function isRootHost(host: string, rootDomain: string): boolean {
  if (!host) return true;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  if (isIpv4(host)) return true;
  if (host === rootDomain || host === `www.${rootDomain}`) return true;
  // Vercel preview / bare project domain.
  if (host.endsWith(".vercel.app")) return true;
  return false;
}

/**
 * @param rawHost   the `Host` header value (may include `:port`)
 * @param rootDomain e.g. "zoviah.app" — the platform's base domain
 */
export function resolveHostContext(
  rawHost: string | null | undefined,
  rootDomain: string,
): HostContext {
  const host = normalizeHost(rawHost);
  const root = normalizeHost(rootDomain) || "zoviah.app";

  if (isRootHost(host, root)) return { kind: "root" };

  // Local testing: <slug>.localhost / <slug>.lvh.me
  for (const localBase of ["localhost", "lvh.me"]) {
    if (host.endsWith(`.${localBase}`)) {
      const label = host.slice(0, -(`.${localBase}`.length));
      return tenantFromLabel(label);
    }
  }

  if (host.endsWith(`.${root}`)) {
    const label = host.slice(0, -(`.${root}`.length));
    return tenantFromLabel(label);
  }

  // Unknown host (a mis-pointed CNAME, a stale preview alias, garbage).
  return { kind: "unknown" };
}

function tenantFromLabel(label: string): HostContext {
  // exactly one label, valid slug shape, not reserved
  if (!label || label.includes(".")) return { kind: "unknown" };
  if (!SLUG_RE.test(label) || label.length > 63) return { kind: "unknown" };
  if (RESERVED_SUBDOMAINS.has(label)) return { kind: "root" };
  return { kind: "tenant", slug: label };
}

/**
 * The platform's base domain, from env only (safe in every runtime).
 * `NEXT_PUBLIC_ROOT_DOMAIN` wins; else derived from `NEXT_PUBLIC_APP_URL`;
 * last resort "zoviah.app". No scheme, no port, no path.
 */
export function deriveRootDomain(
  env: Record<string, string | undefined>,
): string {
  const explicit = (env.NEXT_PUBLIC_ROOT_DOMAIN ?? "").trim().toLowerCase();
  if (explicit) {
    return normalizeHost(explicit.replace(/^https?:\/\//, "").replace(/\/.*$/, ""));
  }
  const appUrl = (env.NEXT_PUBLIC_APP_URL ?? env.APP_URL ?? "").trim();
  if (appUrl) {
    try {
      return new URL(appUrl).hostname.toLowerCase();
    } catch {
      /* fall through */
    }
  }
  return "zoviah.app";
}
