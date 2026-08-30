/**
 * Legal document links. The CONTENT of a privacy policy / terms of service is a
 * legal responsibility (a lawyer must review it) — this app only links to URLs
 * the operator configures. Both are optional; the footer hides a missing link.
 */
function clean(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:" ? s : null;
  } catch {
    return null;
  }
}

export function getLegalLinks(): { privacyUrl: string | null; termsUrl: string | null } {
  return {
    privacyUrl: clean(process.env.NEXT_PUBLIC_PRIVACY_POLICY_URL),
    termsUrl: clean(process.env.NEXT_PUBLIC_TERMS_URL),
  };
}
