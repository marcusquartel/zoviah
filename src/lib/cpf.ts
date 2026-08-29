/**
 * CPF (Brazilian individual taxpayer id) — pure helpers. No I/O.
 *
 * `normalizeCpf` strips any mask and returns the 11 digits only when they form
 * a structurally valid CPF (correct check digits, not a repeated digit).
 * Returns null otherwise — never guesses. CPF is sensitive PII: it is stored
 * digits-only and only ever shown inside the creator modal.
 */
export function normalizeCpf(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length !== 11) return null;
  if (/^(\d)\1{10}$/.test(digits)) return null; // 000... 111... etc.

  const check = (len: number): number => {
    let sum = 0;
    for (let i = 0; i < len; i += 1) {
      sum += Number(digits[i]) * (len + 1 - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  if (check(9) !== Number(digits[9])) return null;
  if (check(10) !== Number(digits[10])) return null;
  return digits;
}

export function isValidCpf(value: unknown): boolean {
  return normalizeCpf(value) !== null;
}

/** "12345678909" -> "123.456.789-09". Pass-through if not 11 digits. */
export function formatCpf(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length !== 11) return digits;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
