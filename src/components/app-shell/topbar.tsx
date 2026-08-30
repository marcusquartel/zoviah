import { MobileNav } from "@/components/app-shell/mobile-nav";
import { UserMenu } from "@/components/app-shell/user-menu";
import { HelpCenter } from "@/features/support/components/help-center";

interface TopbarProps {
  orgName: string;
  userEmail: string;
  role: string;
}

export function Topbar({ orgName, userEmail, role }: TopbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background px-4">
      <div className="flex items-center gap-2">
        <MobileNav orgName={orgName} />
        <span className="text-sm font-medium md:hidden">{orgName}</span>
      </div>
      <div className="flex items-center gap-1">
        <HelpCenter />
        <UserMenu email={userEmail} role={role} />
      </div>
    </header>
  );
}
