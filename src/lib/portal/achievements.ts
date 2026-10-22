/**
 * Portal badges ("conquistas"). Pure — computed only from the creator's own
 * numbers and her ranking position, never from anyone else's values.
 */

export interface AchievementInput {
  monthOrders: number;
  monthSales: number;
  totalOrders: number;
  /** Month ranking position (overall); null when she isn't ranked. */
  position: number | null;
  streakMonths: number;
  /** Approved content this month / ever. */
  monthContent: number;
  totalContent: number;
}

export interface Achievement {
  id: string;
  emoji: string;
  title: string;
  description: string;
  unlocked: boolean;
  /** 0..1 progress toward unlocking. */
  progress: number;
  /** "faltam 3 vendas" — only for locked, measurable badges. */
  remaining: string | null;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function count(current: number, target: number, unit: [string, string]) {
  const left = Math.max(0, Math.ceil(target - current));
  return {
    unlocked: current >= target,
    progress: Math.min(1, target > 0 ? current / target : 1),
    remaining: left > 0 ? `faltam ${left} ${left === 1 ? unit[0] : unit[1]}` : null,
  };
}

function money(current: number, target: number) {
  const left = Math.max(0, target - current);
  return {
    unlocked: current >= target,
    progress: Math.min(1, current / target),
    remaining: left > 0 ? `faltam ${brl.format(left)}` : null,
  };
}

export function computeAchievements(i: AchievementInput): Achievement[] {
  const top = (limit: number) => ({
    unlocked: i.position != null && i.position <= limit && i.monthOrders > 0,
    progress: i.position != null && i.position <= limit && i.monthOrders > 0 ? 1 : 0,
    remaining: null,
  });
  return [
    { id: "first", emoji: "🌱", title: "Primeira venda", description: "Sua primeira venda com o cupom.", ...count(i.totalOrders, 1, ["venda", "vendas"]) },
    { id: "five", emoji: "🔥", title: "Em alta", description: "5 vendas no mês.", ...count(i.monthOrders, 5, ["venda", "vendas"]) },
    { id: "ten", emoji: "🚀", title: "Imparável", description: "10 vendas no mês.", ...count(i.monthOrders, 10, ["venda", "vendas"]) },
    { id: "1k", emoji: "💸", title: "R$ 1 mil", description: "R$ 1.000 vendidos no mês.", ...money(i.monthSales, 1000) },
    { id: "5k", emoji: "💎", title: "R$ 5 mil", description: "R$ 5.000 vendidos no mês.", ...money(i.monthSales, 5000) },
    { id: "podium", emoji: "🏅", title: "Pódio", description: "Top 3 do ranking do mês.", ...top(3) },
    { id: "champion", emoji: "👑", title: "Campeã do mês", description: "1º lugar no ranking do mês.", ...top(1) },
    { id: "streak", emoji: "📅", title: "Constância", description: "Vendas em 3 meses seguidos.", ...count(i.streakMonths, 3, ["mês", "meses"]) },
    { id: "content1", emoji: "📸", title: "Primeiro conteúdo", description: "Primeira publicação aprovada.", ...count(i.totalContent, 1, ["publicação", "publicações"]) },
    { id: "content10", emoji: "🎬", title: "Criadora ativa", description: "10 publicações aprovadas no mês.", ...count(i.monthContent, 10, ["publicação", "publicações"]) },
  ];
}

/** The locked badge closest to unlocking (measurable ones first). */
export function nextAchievement(list: Achievement[]): Achievement | null {
  return (
    list
      .filter((a) => !a.unlocked && a.remaining)
      .sort((a, b) => b.progress - a.progress)[0] ?? null
  );
}
