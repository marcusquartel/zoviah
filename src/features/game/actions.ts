"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { AvatarConfig } from "@/lib/game/catalog";
import type { Json } from "@/types/database";

const uuid = z.uuid();

export async function saveAvatar(
  creatorId: string,
  avatar: AvatarConfig,
): Promise<{ ok: boolean; avatar?: Partial<AvatarConfig>; error?: string }> {
  if (!uuid.safeParse(creatorId).success) return { ok: false, error: "Creator inválida." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_save_avatar", {
    p_creator_id: creatorId,
    p_avatar: avatar as unknown as Json,
  });
  if (error) return { ok: false, error: "Não foi possível salvar o visual." };
  revalidatePath("/portal/jogo");
  return { ok: true, avatar: data as unknown as Partial<AvatarConfig> };
}

export async function markAchievementsSeen(creatorId: string, ids: string[]): Promise<void> {
  if (!uuid.safeParse(creatorId).success) return;
  const clean = ids.filter((id) => /^[a-z0-9]{1,40}$/i.test(id)).slice(0, 50);
  const supabase = await createClient();
  await supabase.rpc("portal_game_seen", { p_creator_id: creatorId, p_ids: clean });
}

export async function sendInteraction(
  from: string,
  to: string,
  kind: "clap" | "heart" | "wave",
): Promise<{ ok: boolean; error?: string }> {
  if (!uuid.safeParse(from).success || !uuid.safeParse(to).success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("portal_interact", { p_from: from, p_to: to, p_kind: kind });
  if (error) {
    return { ok: false, error: error.message.includes("RATE_LIMITED") ? "Calma! Muitas interações seguidas." : "Não foi possível enviar." };
  }
  return { ok: true };
}

export async function collectHennas(creatorId: string, count: number): Promise<number | null> {
  if (!uuid.safeParse(creatorId).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_collect_hennas", {
    p_creator_id: creatorId,
    p_count: Math.max(1, Math.min(10, Math.round(count))),
  });
  return error ? null : (data as number);
}
