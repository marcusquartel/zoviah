"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDay } from "@/features/creators/format";
import { ContentFormDialog } from "@/features/content/components/content-form";
import { deleteContent } from "@/features/content/actions";
import { FORMAT_LABELS, PLATFORM_LABELS, STATUS_LABELS } from "@/features/content/labels";
import type { PortalContent } from "@/features/content/queries";

export function PortalContentSection({
  creatorId,
  content,
  accent,
  canSubmit,
}: {
  creatorId: string;
  content: PortalContent;
  accent: string;
  /** False in the staff preview (the creator submits; staff use the CRM). */
  canSubmit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function remove(id: string) {
    if (!window.confirm("Excluir este registro?")) return;
    startTransition(async () => {
      const res = await deleteContent(id);
      if (res.ok) {
        toast.success("Registro excluído.");
        router.refresh();
      } else toast.error(res.error ?? "Não foi possível excluir.");
    });
  }

  const m = content.month;
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Seus conteúdos</p>
          <p className="text-xs text-muted-foreground">Registre cada post, reels, vídeo ou story com a marca.</p>
        </div>
        {canSubmit ? (
          <Button onClick={() => setOpen(true)} style={{ background: accent }} className="text-white">
            <Plus className="size-4" /> Registrar publicação
          </Button>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Count label="Aprovados no mês" value={m.approved} strong accent={accent} />
        <Count label="Stories" value={m.stories} />
        <Count label="Posts, reels e vídeos" value={m.feed} />
        <Count label="Em análise" value={m.pending} />
      </div>

      {content.items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nada registrado ainda. Postou com a marca? Registre aqui! 📸
        </p>
      ) : (
        <ul className="mt-4 divide-y">
          {content.items.map((c) => (
            <li key={c.id} className="flex items-center gap-3 py-3">
              {c.screenshot_url ? (
                <a href={c.screenshot_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                  <img src={c.screenshot_url} alt="Print" className="h-14 w-10 rounded-md border object-cover" />
                </a>
              ) : (
                <div className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-lg">
                  {c.platform === "tiktok" ? "🎵" : "📷"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {FORMAT_LABELS[c.format]} · {PLATFORM_LABELS[c.platform]}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">{formatDay(c.posted_on)}</span>
                </p>
                {c.url ? (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex max-w-full items-center gap-1 truncate text-xs text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="size-3 shrink-0" /> <span className="truncate">{c.url}</span>
                  </a>
                ) : null}
                {c.status === "rejected" && c.review_note ? (
                  <p className="text-xs text-danger">Motivo: {c.review_note}</p>
                ) : null}
              </div>
              <Badge variant={c.status === "approved" ? "default" : c.status === "rejected" ? "destructive" : "secondary"}>
                {STATUS_LABELS[c.status]}
              </Badge>
              {canSubmit && c.status === "pending" ? (
                <Button variant="ghost" size="icon-sm" aria-label="Excluir" disabled={pending} onClick={() => remove(c.id)}>
                  <Trash2 />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canSubmit ? (
        <ContentFormDialog
          creatorId={creatorId}
          mode="portal"
          open={open}
          onOpenChange={setOpen}
          onSaved={() => router.refresh()}
          accent={accent}
        />
      ) : null}
    </div>
  );
}

function Count({ label, value, strong, accent }: { label: string; value: number; strong?: boolean; accent?: string }) {
  return (
    <div
      className={strong ? "rounded-xl p-3 text-white" : "rounded-xl bg-muted/50 p-3"}
      style={strong ? { background: `linear-gradient(rgba(0,0,0,.22), rgba(0,0,0,.22)), ${accent}` } : undefined}
    >
      <p className={strong ? "text-xs text-white/90" : "text-xs text-muted-foreground"}>{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
