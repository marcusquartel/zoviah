import { buildThemeCss, type BrandColors } from "@/lib/theme";

/**
 * Injects the tenant's brand colors as an override of the semantic theme
 * tokens. Renders nothing when the organization has no (valid) colors set, so
 * the neutral default theme stays in place.
 */
export function ThemeStyle({ primaryColor, secondaryColor }: BrandColors) {
  const css = buildThemeCss({ primaryColor, secondaryColor });
  if (!css) return null;
  return <style>{css}</style>;
}
