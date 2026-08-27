/**
 * Pure, testable normalizers used both by the public submission action and by
 * the dedup logic. The original values are always kept in `applications.answers`
 * — these produce the *comparable* form only.
 */

/** trim + lowercase. Returns null for blank / non-string. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return v.length > 0 && v.includes("@") ? v : null;
}

/**
 * Social handle -> comparable form: strips a leading '@', pulls the handle out
 * of a full profile URL, drops query/hash and surrounding slashes, lowercases.
 * "@Marcus", "marcus", "https://instagram.com/Marcus/" -> "marcus".
 */
export function normalizeHandle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let v = value.trim();
  if (v === "") return null;

  if (/^https?:\/\//i.test(v) || v.includes("/")) {
    v = v.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    // drop domain, keep the first meaningful path segment
    const parts = v.split(/[/?#]/).filter(Boolean);
    v = parts.length > 1 ? parts[1] : (parts[0] ?? "");
  }

  v = v
    .replace(/^@+/, "")
    .split(/[?#]/)[0]
    .trim()
    .toLowerCase();

  return v.length > 0 ? v : null;
}

const PLATFORM_BASE: Record<string, string> = {
  instagram: "https://instagram.com/",
  tiktok: "https://www.tiktok.com/@",
};

/** Canonical public profile URL for a normalized handle, when we know how. */
export function socialProfileUrl(
  platform: string,
  normalizedHandle: string | null,
): string | null {
  if (!normalizedHandle) return null;
  const base = PLATFORM_BASE[platform];
  return base ? `${base}${normalizedHandle}` : null;
}

/**
 * Best-effort E.164 for Brazilian numbers. Only returns a value when the digits
 * are unambiguous; otherwise returns null (never invents a number).
 *
 *  "+55 (11) 98888-7777" -> "+5511988887777"
 *  "11988887777"         -> "+5511988887777"   (11 digits: DDD + mobile)
 *  "1133334444"          -> "+551133334444"    (10 digits: DDD + landline)
 *  "988887777"           -> null               (no DDD -> ambiguous)
 */
export function normalizePhoneBR(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const hadPlus = value.trim().startsWith("+");
  const digits = value.replace(/\D/g, "");
  if (digits === "") return null;

  if (hadPlus) {
    // Trust an explicit international prefix if it's plausibly complete.
    return digits.length >= 11 && digits.length <= 15 ? `+${digits}` : null;
  }
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  return null;
}
