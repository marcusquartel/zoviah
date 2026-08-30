import { NavList } from "@/components/app-shell/nav-list";
import { OrgBadge } from "@/components/app-shell/org-badge";

interface SidebarProps {
  orgName: string;
  logoUrl?: string | null;
  isPlatformAdmin?: boolean;
}

/** Desktop sidebar. Hidden below `md` — the mobile nav lives in the topbar. */
export function Sidebar({ orgName, logoUrl, isPlatformAdmin }: SidebarProps) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
      <OrgBadge name={orgName} logoUrl={logoUrl} />
      <NavList isPlatformAdmin={isPlatformAdmin} />
    </aside>
  );
}
