"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setCreatorAvatar } from "@/features/portal/actions";
import { cn } from "@/lib/utils";

const SIZE = 512;

/** Center-crop to a square and downscale to 512px JPEG in the browser. */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    SIZE,
    SIZE,
  );
  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.85),
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/**
 * The creator's round photo. When `editable`, tapping it uploads a new one
 * (creator in her portal, or brand admin in the CRM). Without a photo it shows
 * initials on the brand gradient.
 */
export function CreatorAvatar({
  creatorId,
  name,
  url,
  editable,
  className,
  gradient,
}: {
  creatorId: string;
  name: string;
  url: string | null;
  editable: boolean;
  className?: string;
  gradient?: string;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState(url);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha uma imagem.");
      return;
    }
    setBusy(true);
    try {
      const blob = await toSquareJpeg(file);
      const supabase = createClient();
      const path = `${creatorId}/${crypto.randomUUID()}.jpg`;
      const { error } = await supabase.storage
        .from("creator-avatars")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (error) throw new Error(error.message);
      const { data } = supabase.storage.from("creator-avatars").getPublicUrl(path);
      const res = await setCreatorAvatar(creatorId, data.publicUrl);
      if (!res.ok) throw new Error(res.error);
      setCurrent(data.publicUrl);
      toast.success("Foto atualizada.");
      router.refresh();
    } catch {
      toast.error("Não foi possível enviar a foto.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const face = current ? (
    // eslint-disable-next-line @next/next/no-img-element -- public storage URL, already 512px
    <img src={current} alt={name} className="size-full rounded-full object-cover" />
  ) : (
    <span
      className="flex size-full items-center justify-center rounded-full text-[2.2em] font-semibold text-white"
      style={{ background: gradient }}
    >
      {initials(name)}
    </span>
  );

  if (!editable) return <div className={cn("relative", className)}>{face}</div>;

  return (
    <button
      type="button"
      onClick={() => input.current?.click()}
      className={cn("group relative rounded-full", className)}
      aria-label="Trocar foto"
      disabled={busy}
    >
      {face}
      <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {busy ? <Loader2 className="size-6 animate-spin" /> : <Camera className="size-6" />}
      </span>
      {busy ? null : (
        <span className="absolute -bottom-1 -right-1 flex size-8 items-center justify-center rounded-full border-2 border-white bg-black/70 text-white">
          <Camera className="size-4" />
        </span>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </button>
  );
}
