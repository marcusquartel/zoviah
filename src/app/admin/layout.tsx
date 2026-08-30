import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentUser } from "@/features/organizations/queries";
import { getIsPlatformAdmin } from "@/features/platform/queries";
import { UserMenu } from "@/components/app-shell/user-menu";

// The /admin area is validated server-side on every request — hiding the nav
// link is never the control (§55).
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) redirect("/login");

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const isAdmin = await getIsPlatformAdmin();
  if (!isAdmin) redirect("/app");

  return (
    <div className="min-h-svh bg-surface">
      <header className="flex h-14 items-center justify-between gap-3 border-b bg-background px-4">
        <Link href="/admin" className="flex items-center gap-2 font-semibold">
          <ShieldCheck className="size-5 text-primary" />
          Creator Hub · Admin SaaS
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/app" className="text-muted-foreground hover:text-foreground">
            Voltar ao app
          </Link>
          <UserMenu email={user.email ?? ""} role="platform_admin" />
        </div>
      </header>
      <nav className="mx-auto flex max-w-6xl gap-1 px-6 pt-4">
        <Link
          href="/admin"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Organizações
        </Link>
        <Link
          href="/admin/audit"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Auditoria
        </Link>
      </nav>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
