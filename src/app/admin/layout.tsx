import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentUser } from "@/features/organizations/queries";
import { getIsPlatformAdmin } from "@/features/platform/queries";
import { UserMenu } from "@/components/app-shell/user-menu";
import { AdminNav } from "@/app/admin/admin-nav";

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
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/85 px-4 backdrop-blur supports-backdrop-filter:bg-background/70">
        <Link
          href="/admin"
          className="flex items-center gap-2 font-heading font-semibold tracking-tight"
        >
          <ShieldCheck className="size-5 text-primary" />
          Creator Hub
          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-secondary-foreground">
            Admin SaaS
          </span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/app"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Voltar ao app
          </Link>
          <UserMenu email={user.email ?? ""} role="platform_admin" />
        </div>
      </header>
      <AdminNav />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
