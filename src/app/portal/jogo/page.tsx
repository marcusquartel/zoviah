import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Fredoka } from "next/font/google";
import { ArrowLeft } from "lucide-react";
import { SetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentOrganization, getCurrentUser } from "@/features/organizations/queries";
import { getMyPortalCreators } from "@/features/portal/queries";
import { getGame } from "@/features/game/queries";
import { GameHub } from "@/features/game/game-hub";
import { toLobbyPlayers } from "@/features/game/to-players";

export const metadata: Metadata = { title: "Glance World" };

const fredoka = Fredoka({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-game" });

export default async function GlanceWorldPage({ searchParams }: { searchParams: Promise<{ c?: string; bots?: string }> }) {
  if (!isSupabaseConfigured()) return <SetupNotice />;
  const user = await getCurrentUser();
  if (!user) redirect("/portal/login?next=/portal/jogo");

  const { c, bots } = await searchParams;
  const creators = await getMyPortalCreators();
  const selected = creators.find((x) => x.creator_id === c) ?? (creators.length === 1 ? creators[0] : null);
  if (!selected) redirect("/portal");

  const game = await getGame(selected.creator_id);
  if (!game) redirect("/portal");

  const me = game.players.find((p) => p.me);
  // Load test for the team: ?bots=500 fills the plaza with local-only bots.
  const requestedBots = Math.min(Math.max(Number.parseInt(bots ?? "", 10) || 0, 0), 1000);
  const botCount =
    requestedBots > 0 && (await getCurrentOrganization())?.organization.id === game.organization_id ? requestedBots : 0;
  const back = creators.length > 1 ? `/portal?c=${selected.creator_id}` : "/portal";

  return (
    <main className={`${fredoka.variable} min-h-svh bg-[#f7f5fb] px-3 py-4 sm:px-6 sm:py-6`}>
      <div className="mx-auto max-w-6xl space-y-3">
        <Link href={back} className="inline-flex items-center gap-1 text-sm font-semibold text-neutral-600 hover:text-neutral-900">
          <ArrowLeft className="size-4" /> Voltar ao portal
        </Link>
        <GameHub
          name={me?.name ?? selected.creator_name}
          stats={game.stats}
          avatar={game.avatar}
          players={toLobbyPlayers(game)}
          seen={game.seen}
          live={{ creatorId: selected.creator_id, orgId: game.organization_id }}
          botCount={botCount}
        />
      </div>
    </main>
  );
}
