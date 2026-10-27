import { MobileNav } from "@/components/app-shell/mobile-nav";
import { UserMenu } from "@/components/app-shell/user-menu";
import { BrandLogo } from "@/components/brand-logo";
import { HelpCenter } from "@/features/support/components/help-center";

interface TopbarProps {
  orgName: string;
  logoUrl?: string | null;
  userEmail: string;
  role: string;
  isPlatformAdmin?: boolean;
  hasPortal?: boolean;
}

export function Topbar({
  orgName,
  logoUrl,
  userEmail,
  role,
  isPlatformAdmin,
  hasPortal,
}: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 bg-background/85 px-4 backdrop-blur supports-backdrop-filter:bg-background/70 sm:px-6 md:rounded-t-[22px] lg:px-10">
      <div className="flex items-center gap-2 md:hidden">
        <MobileNav orgName={orgName} logoUrl={logoUrl} />
        {logoUrl ? (
          <BrandLogo src={logoUrl} alt={orgName} size="xs" />
        ) : (
          <span className="text-sm font-semibold tracking-tight">{orgName}</span>
        )}
      </div>
      <div className="hidden md:block" />
      <div className="flex items-center gap-1">
        <HelpCenter />
        {/* On desktop the account card lives at the foot of the sidebar. */}
        <div className="md:hidden">
          <UserMenu
            email={userEmail}
            role={role}
            orgName={orgName}
            isPlatformAdmin={isPlatformAdmin}
          hasPortal={hasPortal}
          />
        </div>
      </div>
    </header>
  );
}
