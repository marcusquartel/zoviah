/**
 * The single source of truth for the app's absolute base URL — used to build
 * the private link shown to admins (Phase 4). One env var, `NEXT_PUBLIC_APP_URL`
 * (or `APP_URL`), documented in .env.example. Dev falls back to localhost:3001;
 * production refuses a localhost / missing value so a real link is never a
 * dead `http://localhost` link.
 */
const DEV_DEFAULT = "http://localhost:3001";

export function getAppBaseUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "").trim();
  const isProd = process.env.NODE_ENV === "production";

  if (!raw) {
    if (isProd) {
      throw new Error(
        "NEXT_PUBLIC_APP_URL não configurada. Defina a URL pública do app.",
      );
    }
    return DEV_DEFAULT;
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`NEXT_PUBLIC_APP_URL inválida: ${raw}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`NEXT_PUBLIC_APP_URL deve ser http(s): ${raw}`);
  }
  const isLocal =
    parsed.hostname === "localhost" ||
    parsed.hostname === "127.0.0.1" ||
    parsed.hostname.endsWith(".local");
  if (isProd && isLocal) {
    throw new Error("NEXT_PUBLIC_APP_URL não pode ser localhost em produção.");
  }

  // No trailing slash.
  return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/$/, "")}`;
}

/** Absolute URL of the private address-completion page for a raw token. */
export function buildSecureLinkUrl(rawToken: string): string {
  return `${getAppBaseUrl()}/complete/${rawToken}`;
}
