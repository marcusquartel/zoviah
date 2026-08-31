import Link from "next/link";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { ThemeStyle } from "@/components/theme-style";
import { SetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getHostContext, rootUrl } from "@/lib/tenant/context";
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

  const [host, current] = await Promise.all([
    getHostContext(),
    getCurrentOrganization(),
  ]);

  if (!current) {
    // On a tenant subdomain, `null` means the slug is unknown OR the user is
    // not a member — either way, no access, and never a fallback to some other
    // org. We can't tell the two apart (RLS hides non-member orgs), so one
    // screen covers both.
    if (host.kind === "tenant") {
      return (
        <div className="mx-auto flex min-h-svh max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
          <h1 className="text-lg font-semibold">Organização indisponível</h1>
          <p className="text-sm text-muted-foreground">
            Não encontramos esta organização ou sua conta ({user.email}) não
            tem acesso a ela.
          </p>
          <div className="flex gap-3 text-sm">
            <a href={rootUrl("/app")} className="text-primary hover:underline">
              Ir para o painel
            </a>
            <Link href="/login" className="text-muted-foreground hover:text-foreground">
              Entrar com outra conta
            </Link>
          </div>
        </div>
      );
    }
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
            isPlatformAdmin={isPlatformAdmin}
          />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </>
  );
}
