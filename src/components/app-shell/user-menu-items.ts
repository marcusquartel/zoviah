/**
 * Pure description of the account menu's actionable items. Kept out of the
 * client component so it is unit-testable. The component maps these to
 * <DropdownMenuItem>s — the "logout" item always exists; "admin" only for a
 * platform admin; "portal" only when the account is also linked to a creator.
 */
import { PRODUCT } from "../../config/product.ts";

export interface UserMenuItem {
  key: "admin" | "portal" | "logout";
  label: string;
  /** Set for navigation items; absent for action items (logout). */
  href?: string;
  destructive?: boolean;
}

export function buildUserMenuItems(opts: {
  isPlatformAdmin?: boolean;
  hasPortal?: boolean;
}): UserMenuItem[] {
  const items: UserMenuItem[] = [];
  if (opts.isPlatformAdmin) {
    items.push({
      key: "admin",
      label: `Admin ${PRODUCT.name}`,
      href: "/admin",
    });
  }
  if (opts.hasPortal) {
    items.push({ key: "portal", label: "Meu portal de creator", href: "/portal" });
  }
  items.push({ key: "logout", label: "Sair", destructive: true });
  return items;
}
