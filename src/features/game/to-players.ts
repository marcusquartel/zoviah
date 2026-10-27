import { sanitizeAvatar, ITEMS, type AvatarConfig } from "@/lib/game/catalog";
import type { GameData } from "@/features/game/queries";
import type { LobbyPlayer } from "@/features/game/lobby";

// Other creators' avatars are already sanitized by the database against
// their own unlocks; here only fill missing slots with defaults.
const ALL_ITEMS = new Set(ITEMS.map((i) => i.id));

export function toLobbyPlayers(game: GameData): LobbyPlayer[] {
  return game.players.map((p) => ({
    id: p.id,
    name: p.name,
    tier: p.tier ? p.tier.charAt(0) + p.tier.slice(1).toLowerCase() : null,
    position: p.position,
    me: p.me,
    config: sanitizeAvatar(p.avatar as Partial<AvatarConfig>, ALL_ITEMS),
  }));
}
