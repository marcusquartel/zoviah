import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { ThemeStyle } from "@/components/theme-style";
import { SetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  getCurrentOrganization,
  getCurrentUser,
} from "@/features/organizations/queries";
import { getIsPlatformAdmin } from "@/features/platform/queries";
import { SuspendedNotice } from "@/features/platform/components/suspended-notice";

// Every /app route is per-user (auth + tenant), never static.
export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const current = await getCurrentOrganization();

  if (!current) {
    return (
      <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">Nenhuma organização</h1>
        <p className="text-sm text-muted-foreground">
          Sua conta ({user.email}) ainda não está vinculada a uma organização.
          Um administrador precisa adicionar você. Consulte a seção de bootstrap
          no README.
        </p>
      </div>
    );
  }

  const { organization, settings, role } = current;
  const isPlatformAdmin = await getIsPlatformAdmin();

  if (organization.status === "suspended") {
    return (
      <SuspendedNotice
        orgName={organization.name}
        userEmail={user.email ?? ""}
        isPlatformAdmin={isPlatformAdmin}
      />
    );
  }

  return (
    <>
      <ThemeStyle
        primaryColor={settings?.primary_color}
        secondaryColor={settings?.secondary_color}
      />
      <div className="flex min-h-svh bg-surface">
        <Sidebar
          orgName={organization.name}
          logoUrl={settings?.logo_url}
          isPlatformAdmin={isPlatformAdmin}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            orgName={organization.name}
            userEmail={user.email ?? ""}
            role={role}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </>
  );
}
