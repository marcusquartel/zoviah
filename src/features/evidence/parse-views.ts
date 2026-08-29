/**
 * Deliberate parser for a pasted list of view COUNTS (§65). PURE.
 *
 * pt-BR locale: "7.100" means 7100 (thousands separator), NOT 7.1. View counts
 * are non-negative integers, so "." and "," inside a number are grouping
 * separators and are removed. Optional "k"/"mil" (×1_000) and "mi"/"m"
 * (×1_000_000) suffixes are supported because creators paste "12k". Anything
 * else (letters, negatives, empty) is reported as invalid and dropped — never
 * turned into 0 (§14).
 *
 * One number per line is the expected UX; comma / semicolon / whitespace also
 * separate.
 */
export interface ParsedViews {
  values: number[];
  invalid: string[];
}

const TOKEN_RE = /^(\d[\d.,]*)(k|mil|mi|mm|m)?$/i;

function parseToken(token: string): number | null {
  const t = token.trim().toLowerCase();
  if (t === "") return null;

  const match = t.match(TOKEN_RE);
  if (!match) return null;

  const digits = match[1].replace(/[.,]/g, "");
  if (!/^\d+$/.test(digits)) return null;

  let n = Number.parseInt(digits, 10);
  const suffix = match[2];
  if (suffix === "k" || suffix === "mil") n *= 1_000;
  else if (suffix === "mi" || suffix === "m" || suffix === "mm") n *= 1_000_000;

  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

export function parseViews(raw: string): ParsedViews {
  const tokens = raw
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const values: number[] = [];
  const invalid: string[] = [];
  for (const token of tokens) {
    const n = parseToken(token);
    if (n == null) invalid.push(token);
    else values.push(n);
  }
  return { values, invalid };
}
