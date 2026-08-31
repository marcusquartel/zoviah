import { MobileNav } from "@/components/app-shell/mobile-nav";
import { UserMenu } from "@/components/app-shell/user-menu";
import { HelpCenter } from "@/features/support/components/help-center";

interface TopbarProps {
  orgName: string;
  userEmail: string;
  role: string;
  isPlatformAdmin?: boolean;
}

export function Topbar({
  orgName,
  userEmail,
  role,
  isPlatformAdmin,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="flex items-center gap-2">
        <MobileNav orgName={orgName} />
        <span className="text-sm font-semibold tracking-tight md:hidden">
          {orgName}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <HelpCenter />
        <UserMenu
          email={userEmail}
          role={role}
          orgName={orgName}
          isPlatformAdmin={isPlatformAdmin}
        />
      </div>
    </header>
  );
}
