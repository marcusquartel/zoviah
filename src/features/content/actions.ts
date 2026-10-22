"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { mapContentError } from "@/features/content/labels";
import type { Json } from "@/types/database";

export interface ContentActionResult {
  ok: boolean;
  error?: string;
}

const contentSchema = z.object({
  creatorId: z.uuid(),
  platform: z.enum(["instagram", "tiktok"]),
  format: z.enum(["post", "reel", "story", "video"]),
  url: z.string().trim().max(500),
  screenshotPath: z.string().trim().max(300),
  postedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Data inválida." }),
  note: z.string().trim().max(500),
});

export type ContentInput = z.input<typeof contentSchema>;

function payload(v: z.output<typeof contentSchema>): Json {
  return {
    platform: v.platform,
    format: v.format,
    url: v.url,
    screenshot_path: v.screenshotPath,
    posted_on: v.postedOn,
    note: v.note,
  };
}

function revalidate() {
  revalidatePath("/portal");
  revalidatePath("/app/content");
  revalidatePath("/app/creators");
}

/** The creator registers a publication from her portal (goes to review). */
export async function submitContent(input: ContentInput): Promise<ContentActionResult> {
  const parsed = contentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os dados." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("portal_submit_content", {
    p_creator_id: parsed.data.creatorId,
    p: payload(parsed.data),
  });
  if (error) return { ok: false, error: mapContentError(error.message, "Não foi possível registrar.") };
  revalidate();
  return { ok: true };
}

/** Staff registers a publication for a creator (already approved). */
export async function addContentAsStaff(input: ContentInput): Promise<ContentActionResult> {
  const parsed = contentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Revise os dados." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_add_content", {
    p_creator_id: parsed.data.creatorId,
    p: payload(parsed.data),
  });
  if (error) return { ok: false, error: mapContentError(error.message, "Não foi possível registrar.") };
  revalidate();
  return { ok: true };
}

export async function reviewContent(
  id: string,
  status: "approved" | "rejected" | "pending",
  note?: string,
): Promise<ContentActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Publicação não encontrada." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_creator_content", {
    p_id: id,
    p_status: status,
    p_note: note ?? null,
  });
  if (error) return { ok: false, error: mapContentError(error.message, "Não foi possível salvar.") };
  revalidate();
  return { ok: true };
}

export async function deleteContent(id: string): Promise<ContentActionResult> {
  if (!z.uuid().safeParse(id).success) return { ok: false, error: "Publicação não encontrada." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_creator_content", { p_id: id });
  if (error) return { ok: false, error: mapContentError(error.message, "Não foi possível excluir.") };
  const path = (data as { screenshot_path?: string | null } | null)?.screenshot_path;
  if (path) await supabase.storage.from("creator-content").remove([path]);
  revalidate();
  return { ok: true };
}
