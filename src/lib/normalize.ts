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

export type HandlePlatform = "instagram" | "tiktok";

/** Instagram / TikTok usernames: letters, digits, '.', '_'. */
const HANDLE_ALLOWED = /[^a-z0-9._]/g;
/** A leading / trailing '.' or '_' is never a valid username boundary. */
const HANDLE_EDGE = /^[._]+|[._]+$/g;

const HANDLE_MAX: Record<HandlePlatform, number> = {
  instagram: 30, // IG usernames are ≤ 30
  tiktok: 24, //     TikTok usernames are ≤ 24
};

/**
 * Social handle -> comparable form. Conservative: fixes what is unambiguously
 * wrong (a leading '@', a pasted profile URL, a querystring, whitespace,
 * characters that cannot appear in an IG/TikTok username, edge '.'/'_') but
 * never rewrites the middle of an otherwise-valid username.
 *
 *   "@Marcus"                              -> "marcus"
 *   "https://instagram.com/Marcus/"        -> "marcus"
 *   "https://www.tiktok.com/@Marcus?x=1"   -> "marcus"
 *   "@quarteldesign."                      -> "quarteldesign"   (edge '.' dropped)
 *   "marcus.creator"                       -> "marcus.creator"  (kept intact)
 *
 * Pass `platform` to also cap the length to that network's limit.
 */
export function normalizeHandle(
  value: unknown,
  platform?: HandlePlatform,
): string | null {
  if (typeof value !== "string") return null;
  let v = value.trim();
  if (v === "") return null;

  if (/^https?:\/\//i.test(v) || v.includes("/")) {
    v = v.replace(/^https?:\/\//i, "").replace(/^www\./i, "");
    const parts = v.split(/[/?#]/).filter(Boolean);
    // drop the domain, keep the first path segment (the handle)
    v = parts.length > 1 ? parts[1] : (parts[0] ?? "");
  }

  v = v
    .split(/[?#]/)[0] // querystring / hash
    .replace(/@/g, "") // '@' anywhere, not just leading
    .replace(/\s+/g, "") // internal whitespace
    .toLowerCase()
    .replace(HANDLE_ALLOWED, "") // characters that can't be in a username
    .replace(HANDLE_EDGE, ""); // leading / trailing '.' or '_'

  if (v === "") return null;
  if (platform) v = v.slice(0, HANDLE_MAX[platform]);
  return v;
}

/**
 * Soft validation for display / warnings — never used to reject a submission.
 * `true` = looks like a real username for that platform.
 */
export function isPlausibleHandle(
  handle: string,
  platform: HandlePlatform,
): boolean {
  if (platform === "instagram") {
    return /^[a-z0-9._]{1,30}$/.test(handle) && !handle.includes("..");
  }
  return /^[a-z0-9._]{2,24}$/.test(handle);
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
