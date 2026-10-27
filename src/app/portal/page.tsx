import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentUser } from "@/features/organizations/queries";
import { getMyPortalCreators, getPortalDashboard } from "@/features/portal/queries";
import { getPortalContent } from "@/features/content/queries";
import { getGame } from "@/features/game/queries";
import { portalLogout } from "@/features/portal/actions";
import { PortalDashboardView } from "@/features/portal/components/dashboard";
import { ThemeStyle } from "@/components/theme-style";

export const metadata: Metadata = { title: "Meu portal" };

export default async function PortalPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const user = await getCurrentUser();
  if (!user) redirect("/portal/login");

  const { c } = await searchParams;
  const creators = await getMyPortalCreators();

  if (creators.length === 0) {
    return (
      <Shell>
        <div className="mx-auto max-w-md space-y-2 py-20 text-center">
          <h1 className="text-lg font-semibold">Portal não ativado</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta ({user.email}) ainda não tem um portal de creator. Use o
            link do convite que a marca enviou por e-mail.
          </p>
        </div>
      </Shell>
    );
  }

  const selected = creators.find((x) => x.creator_id === c) ?? (creators.length === 1 ? creators[0] : null);
  if (!selected) {
    return (
      <Shell>
        <div className="mx-auto max-w-md space-y-3 py-16">
          <h1 className="text-lg font-semibold">Escolha a marca</h1>
          <ul className="divide-y rounded-lg border bg-card">
            {creators.map((x) => (
              <li key={x.creator_id}>
                <Link href={`/portal?c=${x.creator_id}`} className="block p-4 hover:bg-muted/50">
                  <p className="font-medium">{x.organization_name}</p>
                  <p className="text-sm text-muted-foreground">{x.creator_name}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Shell>
    );
  }

  const [dashboard, content, game] = await Promise.all([
    getPortalDashboard(selected.creator_id),
    getPortalContent(selected.creator_id),
    getGame(selected.creator_id),
  ]);
  if (!dashboard) {
    return (
      <Shell>
        <p className="py-20 text-center text-sm text-muted-foreground">
          Não foi possível carregar seu portal agora. Tente de novo em instantes.
        </p>
      </Shell>
    );
  }

  return (
    <Shell brand={dashboard.organization.name} switchable={creators.length > 1}>
      <ThemeStyle
        primaryColor={dashboard.branding.primary_color}
        secondaryColor={dashboard.branding.secondary_color}
      />
      <PortalDashboardView
        data={dashboard}
        creatorId={selected.creator_id}
        canEditAvatar
        content={content}
        canSubmitContent
        game={game?.stats ?? null}
        gameHref={creators.length > 1 ? `/portal/jogo?c=${selected.creator_id}` : "/portal/jogo"}
      />
    </Shell>
  );
}

function Shell({
  children,
  brand,
  switchable,
}: {
  children: React.ReactNode;
  brand?: string;
  switchable?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{brand ?? "Portal da creator"}</p>
          {brand ? <p className="text-xs text-muted-foreground">Portal da creator</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {switchable ? (
            <Link href="/portal?c=" className="text-sm text-muted-foreground hover:text-foreground">
              Trocar marca
            </Link>
          ) : null}
          <form action={portalLogout}>
            <Button variant="ghost" size="sm" type="submit">
              <LogOut className="size-4" /> Sair
            </Button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
