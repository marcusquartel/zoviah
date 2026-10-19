import { NavList } from "@/components/app-shell/nav-list";
import { OrgBadge } from "@/components/app-shell/org-badge";
import { UserMenu } from "@/components/app-shell/user-menu";

interface SidebarProps {
  orgName: string;
  logoUrl?: string | null;
  userEmail: string;
  role: string;
  isPlatformAdmin?: boolean;
}

/**
 * Desktop sidebar on the paper frame. Hidden below `md` — the mobile nav and
 * account menu live in the topbar.
 */
export function Sidebar({
  orgName,
  logoUrl,
  userEmail,
  role,
  isPlatformAdmin,
}: SidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-svh w-[17rem] shrink-0 flex-col bg-sidebar px-3 pt-5 pb-3 md:flex">
      <OrgBadge name={orgName} logoUrl={logoUrl} />
      <NavList isPlatformAdmin={isPlatformAdmin} />
      <UserMenu
        variant="sidebar"
        email={userEmail}
        role={role}
        orgName={orgName}
        isPlatformAdmin={isPlatformAdmin}
      />
    </aside>
  );
}
