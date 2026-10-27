/**
 * Creator game: avatar items ("skins") and the achievements that unlock them.
 * Pure data + rules (no I/O) so the server can be the source of truth for
 * what a creator has unlocked, and it is unit-tested.
 *
 * All items are original Rare Way–themed designs (blocky, brand colors) —
 * nothing taken from any existing game.
 */

export type Slot =
  | "skin"
  | "hair"
  | "hairColor"
  | "top"
  | "bottom"
  | "head"
  | "back"
  | "pet"
  | "effect"
  | "title";

export type Rarity = "comum" | "raro" | "epico" | "lendario";

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  /** Main color (hex) used by the 3D model and the swatch. */
  color?: string;
  /** Secondary color. */
  color2?: string;
  rarity: Rarity;
  /** Achievement that unlocks it; undefined = available from the start. */
  unlockedBy?: string;
}

export const ITEMS: Item[] = [
  // skin tones — all free
  { id: "skin-1", slot: "skin", name: "Tom 1", color: "#f6d5c3", rarity: "comum" },
  { id: "skin-2", slot: "skin", name: "Tom 2", color: "#e8b796", rarity: "comum" },
  { id: "skin-3", slot: "skin", name: "Tom 3", color: "#c98e66", rarity: "comum" },
  { id: "skin-4", slot: "skin", name: "Tom 4", color: "#a46a43", rarity: "comum" },
  { id: "skin-5", slot: "skin", name: "Tom 5", color: "#7a4a2c", rarity: "comum" },
  { id: "skin-6", slot: "skin", name: "Tom 6", color: "#4f2f1d", rarity: "comum" },

  // hair styles
  { id: "hair-short", slot: "hair", name: "Curto", rarity: "comum" },
  { id: "hair-bob", slot: "hair", name: "Chanel", rarity: "comum" },
  { id: "hair-long", slot: "hair", name: "Longo", rarity: "comum" },
  { id: "hair-curly", slot: "hair", name: "Cacheado", rarity: "comum" },
  { id: "hair-ponytail", slot: "hair", name: "Rabo de cavalo", rarity: "comum" },
  { id: "hair-bun", slot: "hair", name: "Coque alto", rarity: "raro", unlockedBy: "stories12" },

  // hair colors
  { id: "hc-black", slot: "hairColor", name: "Preto", color: "#1d1513", rarity: "comum" },
  { id: "hc-brown", slot: "hairColor", name: "Castanho", color: "#5a3420", rarity: "comum" },
  { id: "hc-red", slot: "hairColor", name: "Ruivo", color: "#a8461f", rarity: "comum" },
  { id: "hc-blond", slot: "hairColor", name: "Loiro", color: "#d9b36a", rarity: "comum" },
  { id: "hc-pink", slot: "hairColor", name: "Rosa Rare", color: "#fd9fb0", rarity: "raro", unlockedBy: "sales1k" },
  { id: "hc-lilac", slot: "hairColor", name: "Lilás Rara", color: "#b297d3", rarity: "epico", unlockedBy: "tierRara" },

  // tops
  { id: "top-tee", slot: "top", name: "Camiseta básica", color: "#f7f5fb", rarity: "comum" },
  { id: "top-tee-black", slot: "top", name: "Camiseta preta", color: "#151515", rarity: "comum" },
  { id: "top-rareway", slot: "top", name: "Camiseta Rare Way", color: "#c1acdc", color2: "#0a0a0a", rarity: "raro", unlockedBy: "first" },
  { id: "top-coat", slot: "top", name: "Jaleco Pro", color: "#ffffff", color2: "#59dbd6", rarity: "raro", unlockedBy: "content1" },
  { id: "top-poderosa", slot: "top", name: "Blazer Poderosa", color: "#fd9fb0", color2: "#0a0a0a", rarity: "epico", unlockedBy: "tierPoderosa" },

  // bottoms
  { id: "bottom-black", slot: "bottom", name: "Calça preta", color: "#1b1b1f", rarity: "comum" },
  { id: "bottom-jeans", slot: "bottom", name: "Jeans", color: "#3d5a80", rarity: "comum" },
  { id: "bottom-lilac", slot: "bottom", name: "Calça lilás", color: "#957db2", rarity: "comum" },
  { id: "bottom-turq", slot: "bottom", name: "Calça turquesa", color: "#48b1ad", rarity: "raro", unlockedBy: "streak3" },

  // head accessories
  { id: "head-none", slot: "head", name: "Nenhum", rarity: "comum" },
  { id: "head-band", slot: "head", name: "Faixa RW", color: "#d9d9de", color2: "#0a0a0a", rarity: "raro", unlockedBy: "five" },
  { id: "head-glasses", slot: "head", name: "Óculos de diamante", color: "#9be9e6", rarity: "epico", unlockedBy: "sales5k" },
  { id: "head-crown", slot: "head", name: "Coroa da Campeã", color: "#f5c542", rarity: "lendario", unlockedBy: "champion" },

  // back
  { id: "back-none", slot: "back", name: "Nenhum", rarity: "comum" },
  { id: "back-wings", slot: "back", name: "Asas lilás", color: "#e0d5ed", rarity: "epico", unlockedBy: "sales25" },
  { id: "back-cape", slot: "back", name: "Capa Jornada Rara", color: "#0a0a0a", color2: "#fd9fb0", rarity: "lendario", unlockedBy: "streak6" },
  { id: "back-backpack", slot: "back", name: "Mochila de Hennas", color: "#7a3f17", color2: "#f7f5fb", rarity: "epico", unlockedBy: "collector" },

  // pets
  { id: "pet-none", slot: "pet", name: "Nenhum", rarity: "comum" },
  { id: "pet-cat", slot: "pet", name: "Gatinho Pincel", color: "#f2a65a", rarity: "epico", unlockedBy: "content10" },
  { id: "pet-bunny", slot: "pet", name: "Coelhinho Glance", color: "#ffffff", color2: "#fd9fb0", rarity: "lendario", unlockedBy: "sales10k" },

  // effects
  { id: "fx-none", slot: "effect", name: "Nenhum", rarity: "comum" },
  { id: "fx-sparkle", slot: "effect", name: "Rastro de brilho", color: "#ffffff", rarity: "raro", unlockedBy: "ten" },
  { id: "fx-aura-turq", slot: "effect", name: "Aura turquesa", color: "#59dbd6", rarity: "epico", unlockedBy: "streak3" },
  { id: "fx-aura-rara", slot: "effect", name: "Aura Rara", color: "#b297d3", rarity: "lendario", unlockedBy: "tierRara" },

  // titles (shown above the name in the lobby)
  { id: "title-none", slot: "title", name: "Sem título", rarity: "comum" },
  { id: "title-seller", slot: "title", name: "Vendedora Rara", rarity: "raro", unlockedBy: "sales1k" },
  { id: "title-podium", slot: "title", name: "Dona do Pódio", rarity: "epico", unlockedBy: "podium" },
  { id: "title-queen", slot: "title", name: "Rainha do Mês", rarity: "lendario", unlockedBy: "champion" },
  { id: "title-legend", slot: "title", name: "Lenda Rare Way", rarity: "lendario", unlockedBy: "orders100" },
  { id: "title-loved", slot: "title", name: "Querida da Comunidade", rarity: "epico", unlockedBy: "loved" },
];

export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));

export interface GameStats {
  monthOrders: number;
  monthSales: number;
  totalOrders: number;
  /** Month ranking position (only when she sold this month). */
  position: number | null;
  streakMonths: number;
  monthContent: number;
  monthStories: number;
  totalContent: number;
  /** 1 = the brand's first categoria (Forte), 2 = second (Poderosa), 3 = third (Rara)… */
  tierLevel: number | null;
  /** Claps / hearts / waves received in Glance World. */
  interactionsReceived: number;
  hennasCollected: number;
}

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  description: string;
  rarity: Rarity;
  /** Physical prize the brand delivers (staff is notified). */
  realPrize?: string;
  /** Current / target, for the progress bar. */
  progress: (s: GameStats) => [number, number];
}

const flag = (ok: boolean): [number, number] => [ok ? 1 : 0, 1];

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first", emoji: "🌱", title: "Primeira venda", description: "Sua primeira venda com o cupom.", rarity: "comum", progress: (s) => [s.totalOrders, 1] },
  { id: "five", emoji: "🔥", title: "Em alta", description: "5 vendas no mês.", rarity: "comum", progress: (s) => [s.monthOrders, 5] },
  { id: "ten", emoji: "🚀", title: "Imparável", description: "10 vendas no mês.", rarity: "raro", progress: (s) => [s.monthOrders, 10] },
  { id: "sales25", emoji: "⚡", title: "Máquina de vendas", description: "25 vendas no mês.", rarity: "epico", progress: (s) => [s.monthOrders, 25] },
  { id: "sales1k", emoji: "💸", title: "R$ 1 mil", description: "R$ 1.000 vendidos no mês.", rarity: "comum", progress: (s) => [s.monthSales, 1000] },
  { id: "sales5k", emoji: "💎", title: "R$ 5 mil", description: "R$ 5.000 vendidos no mês.", rarity: "epico", progress: (s) => [s.monthSales, 5000] },
  {
    id: "sales10k",
    emoji: "🏦",
    title: "R$ 10 mil",
    description: "R$ 10.000 vendidos no mês.",
    rarity: "lendario",
    realPrize: "Kit surpresa Rare Way",
    progress: (s) => [s.monthSales, 10000],
  },
  { id: "podium", emoji: "🏅", title: "Pódio", description: "Top 3 do ranking do mês.", rarity: "epico", progress: (s) => flag(s.position != null && s.position <= 3) },
  {
    id: "champion",
    emoji: "👑",
    title: "Campeã do mês",
    description: "1º lugar no ranking do mês.",
    rarity: "lendario",
    realPrize: "Lançamento Rare Way antes de todo mundo",
    progress: (s) => flag(s.position === 1),
  },
  { id: "streak3", emoji: "📅", title: "Constância", description: "Vendas em 3 meses seguidos.", rarity: "raro", progress: (s) => [s.streakMonths, 3] },
  { id: "streak6", emoji: "🗓️", title: "Veterana", description: "Vendas em 6 meses seguidos.", rarity: "lendario", progress: (s) => [s.streakMonths, 6] },
  {
    id: "orders100",
    emoji: "💯",
    title: "Centena",
    description: "100 vendas desde o início.",
    rarity: "lendario",
    realPrize: "Placa de reconhecimento",
    progress: (s) => [s.totalOrders, 100],
  },
  { id: "content1", emoji: "📸", title: "Primeiro conteúdo", description: "Primeira publicação aprovada.", rarity: "comum", progress: (s) => [s.totalContent, 1] },
  { id: "content10", emoji: "🎬", title: "Criadora ativa", description: "10 publicações aprovadas no mês.", rarity: "epico", progress: (s) => [s.monthContent, 10] },
  { id: "stories12", emoji: "📲", title: "Rainha dos stories", description: "12 stories aprovados no mês.", rarity: "raro", progress: (s) => [s.monthStories, 12] },
  { id: "tierPoderosa", emoji: "⭐", title: "Poderosa", description: "Chegou à categoria Poderosa.", rarity: "epico", progress: (s) => flag((s.tierLevel ?? 0) >= 2) },
  { id: "tierRara", emoji: "💜", title: "Rara", description: "Chegou à categoria Rara.", rarity: "lendario", progress: (s) => flag((s.tierLevel ?? 0) >= 3) },
  { id: "loved", emoji: "💖", title: "Querida da comunidade", description: "Receba 50 aplausos e carinhos no Glance World.", rarity: "epico", progress: (s) => [s.interactionsReceived, 50] },
  { id: "collector", emoji: "🤎", title: "Colecionadora", description: "Colete 100 hennas no Glance World.", rarity: "epico", progress: (s) => [s.hennasCollected, 100] },
];

export interface AchievementState extends Achievement {
  unlocked: boolean;
  /** 0..1 */
  ratio: number;
  current: number;
  target: number;
  rewards: Item[];
}

export function evaluateAchievements(s: GameStats): AchievementState[] {
  return ACHIEVEMENTS.map((a) => {
    const [current, target] = a.progress(s);
    const ratio = Math.max(0, Math.min(1, target > 0 ? current / target : 0));
    return {
      ...a,
      current,
      target,
      ratio,
      unlocked: current >= target,
      rewards: ITEMS.filter((i) => i.unlockedBy === a.id),
    };
  });
}

/** Item ids the creator may equip. */
export function unlockedItemIds(s: GameStats): Set<string> {
  const done = new Set(evaluateAchievements(s).filter((a) => a.unlocked).map((a) => a.id));
  return new Set(ITEMS.filter((i) => !i.unlockedBy || done.has(i.unlockedBy)).map((i) => i.id));
}

export type AvatarConfig = Record<Slot, string>;

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: "skin-3",
  hair: "hair-long",
  hairColor: "hc-brown",
  top: "top-tee",
  bottom: "bottom-black",
  head: "head-none",
  back: "back-none",
  pet: "pet-none",
  effect: "fx-none",
  title: "title-none",
};

/** Drop anything not unlocked (or unknown) back to the default for its slot. */
export function sanitizeAvatar(config: Partial<AvatarConfig>, unlocked: Set<string>): AvatarConfig {
  const out = { ...DEFAULT_AVATAR };
  for (const slot of Object.keys(DEFAULT_AVATAR) as Slot[]) {
    const id = config[slot];
    const item = id ? ITEM_BY_ID.get(id) : undefined;
    if (item && item.slot === slot && unlocked.has(id!)) out[slot] = id!;
  }
  return out;
}

export const RARITY_LABEL: Record<Rarity, string> = {
  comum: "Comum",
  raro: "Raro",
  epico: "Épico",
  lendario: "Lendário",
};

export const RARITY_COLOR: Record<Rarity, string> = {
  comum: "#9ca3af",
  raro: "#59dbd6",
  epico: "#b297d3",
  lendario: "#f5c542",
};
