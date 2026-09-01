/**
 * CPF helpers. Pure and relative-import-only so the node test runner can load
 * it. Mirrors the SQL `is_valid_cpf` in
 * `supabase/migrations/20260901000002_address_cpf_reintroduce.sql`.
 */

/** Digits only. */
export function stripCpf(raw: string): string {
  return (raw ?? "").replace(/\D/g, "");
}

/** `000.000.000-00` from 11 digits; returns the input unchanged otherwise. */
export function formatCpf(raw: string): string {
  const d = stripCpf(raw);
  if (d.length !== 11) return raw;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

/**
 * Structural CPF validation: 11 digits, not a single repeated digit, and both
 * check digits correct. Not a registry lookup.
 */
export function isValidCpf(raw: string): boolean {
  const cpf = stripCpf(raw);
  if (!/^\d{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split("").map(Number);

  const check = (upTo: number): number => {
    let sum = 0;
    for (let i = 0; i < upTo; i += 1) {
      sum += digits[i] * (upTo + 1 - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  return check(9) === digits[9] && check(10) === digits[10];
}
