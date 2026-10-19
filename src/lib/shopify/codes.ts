/**
 * Affiliate-code helpers. Pure and dependency-free so client components can
 * import them (parse.ts pulls in node:crypto).
 */

/** Affiliate code as stored: uppercase A–Z 0–9 _ -, 3–40 chars. */
export function normalizeAffiliateCode(input: string): string | null {
  const s = (input ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9_-]/g, "");
  return /^[A-Z0-9_-]{3,40}$/.test(s) ? s : null;
}

/** A suggested code from a creator name: "Mariana Souza" → "MARIANA". */
export function suggestAffiliateCode(name: string): string {
  const first = (name ?? "").trim().split(/\s+/)[0] ?? "";
  return normalizeAffiliateCode(first) ?? normalizeAffiliateCode(`${first}10`) ?? "CREATOR";
}
