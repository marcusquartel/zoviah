/**
 * Pure description of the account menu's actionable items. Kept out of the
 * client component so it is unit-testable. The component maps these to
 * <DropdownMenuItem>s — the "logout" item always exists; "admin" only for a
 * platform admin.
 */
import { PRODUCT } from "../../config/product.ts";

export interface UserMenuItem {
  key: "admin" | "logout";
  label: string;
  /** Set for navigation items; absent for action items (logout). */
  href?: string;
  destructive?: boolean;
}

export function buildUserMenuItems(opts: {
  isPlatformAdmin?: boolean;
}): UserMenuItem[] {
  const items: UserMenuItem[] = [];
  if (opts.isPlatformAdmin) {
    items.push({
      key: "admin",
      label: `Admin ${PRODUCT.name}`,
      href: "/admin",
    });
  }
  items.push({ key: "logout", label: "Sair", destructive: true });
  return items;
}
