import { DEFAULT_AVATAR, ITEMS, type AvatarConfig, type Slot } from "@/lib/game/catalog";
import type { LobbyPlayer } from "@/features/game/lobby";

/**
 * Load test: N simulated visitors for Glance World (staff only, local to the
 * viewer — nothing goes to the channel or the database). Deterministic so
 * the crowd is stable across re-renders.
 */
const NAMES = ["Ana", "Bia", "Carol", "Duda", "Fê", "Gabi", "Isa", "Ju", "Lu", "Mari", "Nina", "Paty", "Rafa", "Sofi", "Vivi"];
const SLOTS: Slot[] = ["skin", "hair", "hairColor", "top", "bottom", "head", "back", "pet", "effect", "title"];
// Pets/effects/accessories are rarer, like in a real crowd.
const OPTIONAL: Partial<Record<Slot, number>> = { head: 0.35, back: 0.25, pet: 0.2, effect: 0.15, title: 0.3 };

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export function makeBots(count: number): LobbyPlayer[] {
  const bySlot = new Map<Slot, string[]>();
  for (const it of ITEMS) bySlot.set(it.slot, [...(bySlot.get(it.slot) ?? []), it.id]);
  return Array.from({ length: count }, (_, i) => {
    const r = rng(i * 7919 + 13);
    const config = { ...DEFAULT_AVATAR } as AvatarConfig;
    for (const slot of SLOTS) {
      const chance = OPTIONAL[slot];
      if (chance != null && r() > chance) continue;
      const options = (bySlot.get(slot) ?? []).filter((id) => !id.endsWith("-none"));
      if (options.length) config[slot] = options[Math.floor(r() * options.length)];
    }
    return {
      id: `bot-${i + 1}`,
      name: `${NAMES[i % NAMES.length]} ${String(i + 1).padStart(3, "0")}`,
      tier: null,
      position: null,
      config,
    };
  });
}
