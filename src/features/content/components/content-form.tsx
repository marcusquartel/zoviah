"use client";

import { useRef, useState, useTransition } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient } from "@/lib/supabase/client";
import { addContentAsStaff, submitContent } from "@/features/content/actions";
import { FORMATS_BY_PLATFORM, FORMAT_LABELS, PLATFORM_LABELS } from "@/features/content/labels";
import type { ContentFormat, ContentPlatform } from "@/types/database";
import { cn } from "@/lib/utils";

const MAX_SIDE = 1600;

/** Downscale (no crop — stories are 9:16) to JPEG in the browser. */
async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.85),
  );
}

function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

/**
 * "Registrar publicação". `mode="portal"`: the creator (goes to review);
 * `mode="staff"`: brand admin registering for her (approved right away).
 */
export function ContentFormDialog({
  creatorId,
  mode,
  open,
  onOpenChange,
  onSaved,
  accent,
}: {
  creatorId: string;
  mode: "portal" | "staff";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
  accent?: string;
}) {
  const [platform, setPlatform] = useState<ContentPlatform>("instagram");
  const [format, setFormat] = useState<ContentFormat>("story");
  const [url, setUrl] = useState("");
  const [postedOn, setPostedOn] = useState(today());
  const [note, setNote] = useState("");
  const [shot, setShot] = useState<{ path: string; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  function reset() {
    setUrl("");
    setNote("");
    setShot(null);
    setError(null);
    setPostedOn(today());
  }

  function choosePlatform(p: ContentPlatform) {
    setPlatform(p);
    if (!FORMATS_BY_PLATFORM[p].includes(format)) setFormat(FORMATS_BY_PLATFORM[p][0]);
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Envie uma imagem (print da tela).");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const blob = await toJpeg(file);
      const path = `${creatorId}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await createClient()
        .storage.from("creator-content")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) throw new Error(upErr.message);
      setShot({ path, preview: URL.createObjectURL(blob) });
    } catch {
      setError("Não foi possível enviar o print. Tente de novo.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  function save() {
    setError(null);
    if (!url.trim() && !shot) {
      setError(format === "story" ? "Envie um print do story (ou o link)." : "Cole o link da publicação.");
      return;
    }
    startTransition(async () => {
      const input = {
        creatorId,
        platform,
        format,
        url: url.trim(),
        screenshotPath: shot?.path ?? "",
        postedOn,
        note,
      };
      const res = mode === "portal" ? await submitContent(input) : await addContentAsStaff(input);
      if (res.ok) {
        toast.success(mode === "portal" ? "Publicação enviada para análise! ✨" : "Publicação registrada.");
        reset();
        onOpenChange(false);
        onSaved?.();
      } else setError(res.error ?? "Não foi possível registrar.");
    });
  }

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 text-sm transition-colors",
      active ? "border-transparent font-medium text-white" : "text-muted-foreground hover:text-foreground",
    );
  const chipStyle = (active: boolean) => (active ? { background: accent ?? "var(--primary)" } : undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar publicação</DialogTitle>
          <DialogDescription>
            {mode === "portal"
              ? "Conte pra gente o que você postou com a marca. A equipe confere e aprova."
              : "Registro feito pela equipe — entra como aprovado."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Rede</Label>
            <div className="flex gap-2">
              {(["instagram", "tiktok"] as const).map((p) => (
                <button key={p} type="button" className={chip(platform === p)} style={chipStyle(platform === p)} onClick={() => choosePlatform(p)}>
                  {PLATFORM_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <div className="flex flex-wrap gap-2">
              {FORMATS_BY_PLATFORM[platform].map((f) => (
                <button key={f} type="button" className={chip(format === f)} style={chipStyle(format === f)} onClick={() => setFormat(f)}>
                  {FORMAT_LABELS[f]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="content-url">Link {format === "story" ? "(opcional)" : ""}</Label>
            <Input
              id="content-url"
              inputMode="url"
              placeholder={platform === "instagram" ? "https://www.instagram.com/p/…" : "https://www.tiktok.com/@…/video/…"}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Print {format === "story" ? "(o story some em 24h — mande o print)" : "(opcional)"}</Label>
            {shot ? (
              <div className="relative w-28">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img src={shot.preview} alt="Print enviado" className="w-28 rounded-lg border object-cover" />
                <button
                  type="button"
                  onClick={() => setShot(null)}
                  className="absolute -right-2 -top-2 rounded-full bg-black/70 p-1 text-white"
                  aria-label="Remover print"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : (
              <Button type="button" variant="outline" onClick={() => fileInput.current?.click()} disabled={uploading}>
                {uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
                {uploading ? "Enviando…" : "Enviar print"}
              </Button>
            )}
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </div>

          <div className="grid grid-cols-[10rem_1fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="content-date">Data da postagem</Label>
              <Input id="content-date" type="date" value={postedOn} onChange={(e) => setPostedOn(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="content-note">Observação (opcional)</Label>
            <Textarea id="content-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={pending || uploading} style={accent ? { background: accent } : undefined}>
              {pending ? "Enviando…" : mode === "portal" ? "Enviar" : "Registrar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
