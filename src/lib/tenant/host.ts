/**
 * Host → tenant resolution (Phase 8A).
 *
 * `<subdomain>.zoviah.app` selects an organization CONTEXT. It never grants
 * authorization — membership is still checked server-side and RLS is still the
 * last barrier. This module is pure and unit-tested.
 *
 * The host label is matched against `organizations.subdomain`, NOT
 * `organizations.slug`. Slug stays reserved for the public form URLs
 * (`/p/<slug>/...`); subdomain is the commercial tenant host. They are
 * independent: Rare Way is `slug = "rare-way"`, `subdomain = "rareway"`.
 *
 *   zoviah.app              -> root
 *   www.zoviah.app          -> root
 *   <anything>.vercel.app   -> root  (preview / the bare project domain)
 *   localhost[:port]        -> root
 *   127.0.0.1 / [::1] / IPs -> root
 *   rareway.zoviah.app      -> tenant, subdomain "rareway"
 *   rareway.localhost:3001  -> tenant, subdomain "rareway"  (local testing, opt-in)
 *   a.b.zoviah.app          -> unknown (not a single tenant label)
 */

export type HostContext =
  | { kind: "root" }
  | { kind: "tenant"; subdomain: string }
  | { kind: "unknown" };

/** Labels that can never be a tenant subdomain even if the format allows them. */
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

/** A valid DNS label under 64 chars — the shape of both slug and subdomain. */
const SUBDOMAIN_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Whether a candidate subdomain has a valid DNS-label shape and length. */
export function isValidSubdomainFormat(label: string): boolean {
  return SUBDOMAIN_RE.test(label) && label.length >= 1 && label.length <= 63;
}

/** Whether a label is on the reserved list and can never be a tenant host. */
export function isReservedSubdomain(label: string): boolean {
  return RESERVED_SUBDOMAINS.has(label.trim().toLowerCase());
}

/**
 * A suggested subdomain for a new organization, derived from its name:
 * transliterate, drop everything but `[a-z0-9]`, and remove separators so the
 * result reads as one commercial word ("Rare Way" -> "rareway"). Only a
 * suggestion — the platform admin can edit it before saving.
 */
export function suggestSubdomain(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 63);
}

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

  // Local testing: <subdomain>.localhost / <subdomain>.lvh.me
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
  // exactly one label, valid subdomain shape, not reserved
  if (!label || label.includes(".")) return { kind: "unknown" };
  if (!isValidSubdomainFormat(label)) return { kind: "unknown" };
  if (RESERVED_SUBDOMAINS.has(label)) return { kind: "root" };
  return { kind: "tenant", subdomain: label };
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
