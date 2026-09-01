import { MobileNav } from "@/components/app-shell/mobile-nav";
import { UserMenu } from "@/components/app-shell/user-menu";
import { HelpCenter } from "@/features/support/components/help-center";

interface TopbarProps {
  orgName: string;
  logoUrl?: string | null;
  userEmail: string;
  role: string;
  isPlatformAdmin?: boolean;
}

export function Topbar({
  orgName,
  logoUrl,
  userEmail,
  role,
  isPlatformAdmin,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur supports-backdrop-filter:bg-background/70">
      <div className="flex items-center gap-2 md:hidden">
        <MobileNav orgName={orgName} logoUrl={logoUrl} />
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={orgName}
            className="h-6 w-auto max-w-[110px] object-contain"
          />
        ) : (
          <span className="text-sm font-semibold tracking-tight">{orgName}</span>
        )}
      </div>
      <div className="hidden md:block" />
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
