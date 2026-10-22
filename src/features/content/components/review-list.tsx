"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDay } from "@/features/creators/format";
import { deleteContent, reviewContent } from "@/features/content/actions";
import { FORMAT_LABELS, PLATFORM_LABELS, STATUS_LABELS } from "@/features/content/labels";
import type { StaffContentRow } from "@/features/content/queries";

/** Staff list with approve / reject / delete. `onChanged` for client-loaded lists. */
export function ContentReviewList({
  rows,
  showCreator = true,
  canReview,
  onChanged,
}: {
  rows: StaffContentRow[];
  showCreator?: boolean;
  canReview: boolean;
  onChanged?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function done(ok: boolean, error: string | undefined, msg: string) {
    if (ok) {
      toast.success(msg);
      if (onChanged) onChanged();
      else router.refresh();
    } else toast.error(error ?? "Não foi possível salvar.");
  }

  function approve(id: string) {
    startTransition(async () => {
      const r = await reviewContent(id, "approved");
      done(r.ok, r.error, "Publicação aprovada.");
    });
  }
  function reject(id: string) {
    const note = window.prompt("Motivo da recusa (a creator vai ver):") ?? null;
    if (note === null) return;
    startTransition(async () => {
      const r = await reviewContent(id, "rejected", note);
      done(r.ok, r.error, "Publicação recusada.");
    });
  }
  function reopen(id: string) {
    startTransition(async () => {
      const r = await reviewContent(id, "pending");
      done(r.ok, r.error, "Voltou para análise.");
    });
  }
  function remove(id: string) {
    if (!window.confirm("Excluir este registro?")) return;
    startTransition(async () => {
      const r = await deleteContent(id);
      done(r.ok, r.error, "Registro excluído.");
    });
  }

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma publicação aqui.</p>;
  }

  return (
    <ul className="divide-y">
      {rows.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
          {c.screenshot_url ? (
            <a href={c.screenshot_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
              <img src={c.screenshot_url} alt="Print" className="h-16 w-11 rounded-md border object-cover" />
            </a>
          ) : (
            <div className="flex h-16 w-11 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-lg">
              {c.platform === "tiktok" ? "🎵" : "📷"}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              {showCreator ? <b>{c.creator_name} · </b> : null}
              {FORMAT_LABELS[c.format]} no {PLATFORM_LABELS[c.platform]}
              <span className="ml-2 text-xs text-muted-foreground">
                {formatDay(c.posted_on)}
                {c.source === "staff" ? " · registrado pela equipe" : ""}
              </span>
            </p>
            {c.url ? (
              <a
                href={c.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex max-w-full items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="size-3 shrink-0" /> <span className="truncate">{c.url}</span>
              </a>
            ) : null}
            {c.note ? <p className="text-xs text-muted-foreground">“{c.note}”</p> : null}
            {c.status === "rejected" && c.review_note ? (
              <p className="text-xs text-danger">Motivo: {c.review_note}</p>
            ) : null}
          </div>
          <Badge variant={c.status === "approved" ? "default" : c.status === "rejected" ? "destructive" : "secondary"}>
            {STATUS_LABELS[c.status]}
          </Badge>
          {canReview ? (
            <div className="flex gap-1">
              {c.status === "pending" ? (
                <>
                  <Button size="sm" onClick={() => approve(c.id)} disabled={pending}>
                    <Check className="size-4" /> Aprovar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => reject(c.id)} disabled={pending}>
                    <X className="size-4" /> Recusar
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => reopen(c.id)} disabled={pending}>
                  <RotateCcw className="size-4" /> Reabrir
                </Button>
              )}
              <Button size="icon-sm" variant="ghost" aria-label="Excluir" onClick={() => remove(c.id)} disabled={pending}>
                <Trash2 />
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
