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

export function buildThemeCss({
  primaryColor,
  secondaryColor,
}: BrandColors): string | null {
  const declarations: string[] = [];

  if (primaryColor && HEX.test(primaryColor)) {
    declarations.push(`--primary: ${primaryColor};`);
    declarations.push(`--sidebar-primary: ${primaryColor};`);
    declarations.push(`--ring: ${primaryColor};`);
  }
  if (secondaryColor && HEX.test(secondaryColor)) {
    declarations.push(`--secondary: ${secondaryColor};`);
  }

  if (declarations.length === 0) return null;
  return `:root{${declarations.join("")}}`;
}
