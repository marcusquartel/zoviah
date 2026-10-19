/**
 * White-label theming.
 *
 * A tenant stores brand colors on `organization_settings`. We turn those into
 * a tiny CSS override of the semantic `--primary` / `--secondary` tokens that
 * <ThemeStyle> injects into the page. Every shadcn/ui component reads those
 * tokens, so nothing else needs to know about per-tenant branding.
 *
 * Only well-formed `#rgb` / `#rrggbb` values are emitted; anything else is
 * ignored so a bad value can never break the page.
 */
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export interface BrandColors {
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

/** Ink / white — whichever reads better on `hex` (WCAG relative luminance). */
export function readableOn(hex: string): "#26262d" | "#ffffff" {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const lin = (i: number) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(0) + 0.7152 * lin(2) + 0.0722 * lin(4);
  // Contrast vs white = 1.05/(L+.05); vs ink (L≈0.019) = (L+.05)/0.069.
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.069 ? "#ffffff" : "#26262d";
}

export function buildThemeCss({
  primaryColor,
  secondaryColor,
}: BrandColors): string | null {
  const declarations: string[] = [];

  if (primaryColor && HEX.test(primaryColor)) {
    const fg = readableOn(primaryColor);
    declarations.push(`--primary: ${primaryColor};`);
    declarations.push(`--primary-foreground: ${fg};`);
    if (fg === "#26262d") {
      declarations.push(`--primary-on-ink: ${primaryColor};`);
    }
    declarations.push(`--sidebar-primary: ${primaryColor};`);
    declarations.push(`--sidebar-primary-foreground: ${fg};`);
    declarations.push(`--ring: ${primaryColor};`);
  }
  if (secondaryColor && HEX.test(secondaryColor)) {
    declarations.push(`--secondary: ${secondaryColor};`);
  }

  if (declarations.length === 0) return null;
  return `:root{${declarations.join("")}}`;
}
