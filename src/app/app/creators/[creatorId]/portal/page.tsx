import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Eye } from "lucide-react";
import { getPortalPreview } from "@/features/portal/queries";
import { getPortalContent } from "@/features/content/queries";
import { getGame } from "@/features/game/queries";
import { PortalDashboardView } from "@/features/portal/components/dashboard";

export const metadata: Metadata = { title: "Portal da creator (visualização)" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Staff preview: exactly the payload the creator gets on /portal, rendered
 * with the same view. Owner/admin only (enforced by portal_dashboard_preview).
 */
export default async function CreatorPortalPreviewPage({
  params,
}: {
  params: Promise<{ creatorId: string }>;
}) {
  const { creatorId } = await params;
  if (!UUID_RE.test(creatorId)) notFound();
  const [data, content, game] = await Promise.all([
    getPortalPreview(creatorId),
    getPortalContent(creatorId),
    getGame(creatorId),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed bg-surface px-4 py-3 text-sm">
        <span className="flex items-center gap-2">
          <Eye className="size-4 text-muted-foreground" />
          {data
            ? `Você está vendo o portal como ${data.creator.full_name} vê.`
            : "Portal indisponível para esta creator."}
        </span>
        <Link href="/app/creators" className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Voltar ao CRM
        </Link>
      </div>
      {data ? (
        <div className="mx-auto max-w-5xl">
          <PortalDashboardView
            data={data}
            creatorId={creatorId}
            canEditAvatar
            content={content}
            canSubmitContent={false}
            game={game?.stats ?? null}
            gameHref={null}
          />
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Apenas owners e admins da marca podem ver o portal de uma creator.
        </p>
      )}
    </div>
  );
}
