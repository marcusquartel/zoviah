import { createClient } from "@/lib/supabase/server";
import type { AvatarConfig, GameStats } from "@/lib/game/catalog";

export interface GamePlayerRow {
  id: string;
  name: string;
  tier: string | null;
  position: number | null;
  avatar: Partial<AvatarConfig>;
  me: boolean;
}

export interface GameData {
  organization_id: string;
  stats: GameStats;
  /** Achievement ids unlocked now (computed in the database). */
  unlocked: string[];
  /** Achievement ids she has already been shown. */
  seen: string[];
  avatar: Partial<AvatarConfig>;
  players: GamePlayerRow[];
}

/** Glance World data for a creator (herself, or an owner/admin previewing). */
export async function getGame(creatorId: string): Promise<GameData | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_game", { p_creator_id: creatorId });
  if (error || !data) return null;
  return data as unknown as GameData;
}
