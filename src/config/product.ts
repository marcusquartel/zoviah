/**
 * Single source of truth for the product's public brand.
 *
 * "Zoviah" is the brand. "Creator" remains the business domain — creators,
 * Creator Score, creator_analyses etc. are unchanged. This file only carries
 * user-facing brand strings; it is not a CMS and not a theming system (a
 * tenant's own logo/name still take priority wherever the experience is
 * tenant-branded).
 *
 * The production URL is NOT hard-coded here — `NEXT_PUBLIC_APP_URL` stays the
 * source of truth for the running app's URL. `domain` below is informational
 * (the intended primary domain) for docs and copy only.
 */
export const PRODUCT = {
  name: "Zoviah",
  shortName: "Zoviah",
  description: "Creator Relationship Platform",
  /** Intended primary domain — informational only, not the runtime URL. */
  domain: "zoviah.app",
} as const;

/** `"<section> · Zoviah"` — used by page `metadata.title` via the layout template. */
export function pageTitle(section: string): string {
  return `${section} · ${PRODUCT.name}`;
}
