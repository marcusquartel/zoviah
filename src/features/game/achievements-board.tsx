"use client";

import { RARITY_COLOR, RARITY_LABEL, type AchievementState, type Item } from "@/lib/game/catalog";
import { cn } from "@/lib/utils";

const XP: Record<AchievementState["rarity"], number> = { comum: 50, raro: 100, epico: 200, lendario: 400 };
const LEVEL_XP = 250;

export function levelOf(list: AchievementState[]) {
  const xp = list.filter((a) => a.unlocked).reduce((t, a) => t + XP[a.rarity], 0);
  return { xp, level: Math.floor(xp / LEVEL_XP) + 1, intoLevel: xp % LEVEL_XP, perLevel: LEVEL_XP };
}

export function LevelBar({ list, name }: { list: AchievementState[]; name: string }) {
  const { level, intoLevel, perLevel, xp } = levelOf(list);
  const unlocked = list.filter((a) => a.unlocked).length;
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-3xl border-4 border-[#0a0a0a] bg-[#c1acdc] p-4 shadow-[6px_6px_0_#0a0a0a]">
      <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl border-4 border-[#0a0a0a] bg-[#f5c542] shadow-[3px_3px_0_#0a0a0a]">
        <span className="text-[0.6rem] font-extrabold uppercase leading-none">Nível</span>
        <span className="text-2xl font-black leading-none">{level}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-lg font-extrabold leading-tight">{name}</p>
        <div className="mt-2 h-5 overflow-hidden rounded-full border-[3px] border-[#0a0a0a] bg-white">
          <div className="h-full rounded-full bg-[#59dbd6]" style={{ width: `${Math.round((intoLevel / perLevel) * 100)}%` }} />
        </div>
        <p className="mt-1 text-xs font-bold">
          {xp} XP · faltam {perLevel - intoLevel} XP para o nível {level + 1} · 🎖️ {unlocked}/{list.length} conquistas
        </p>
      </div>
    </div>
  );
}

export function AchievementsBoard({ list }: { list: AchievementState[] }) {
  const sorted = [...list].sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || b.ratio - a.ratio);
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((a) => (
        <AchievementCard key={a.id} a={a} />
      ))}
    </div>
  );
}

function AchievementCard({ a }: { a: AchievementState }) {
  const rc = RARITY_COLOR[a.rarity];
  return (
    <div
      className={cn(
        "relative flex flex-col gap-2 overflow-hidden rounded-3xl border-4 border-[#0a0a0a] p-3 shadow-[5px_5px_0_#0a0a0a]",
        a.unlocked ? "bg-white" : "bg-neutral-100",
      )}
    >
      <div className="absolute inset-x-0 top-0 h-2" style={{ background: rc }} />
      <div className="flex items-start gap-3 pt-1">
        <span
          className={cn(
            "flex size-14 shrink-0 items-center justify-center rounded-2xl border-[3px] border-[#0a0a0a] text-3xl",
            !a.unlocked && "grayscale",
          )}
          style={{ background: a.unlocked ? rc : "#e5e5e5" }}
        >
          {a.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-extrabold leading-tight">{a.title}</p>
          <p className="text-xs text-neutral-600">{a.description}</p>
          <span className="mt-1 inline-block text-[0.6rem] font-extrabold uppercase" style={{ color: rc }}>
            {RARITY_LABEL[a.rarity]} · +{XP[a.rarity]} XP
          </span>
        </div>
        {a.unlocked ? (
          <span className="rounded-full border-2 border-[#0a0a0a] bg-[#59dbd6] px-2 py-0.5 text-[0.6rem] font-extrabold">
            ✓ FEITO
          </span>
        ) : null}
      </div>

      {!a.unlocked ? (
        <div>
          <div className="h-3.5 overflow-hidden rounded-full border-2 border-[#0a0a0a] bg-white">
            <div className="h-full rounded-full" style={{ width: `${Math.round(a.ratio * 100)}%`, background: rc }} />
          </div>
          <p className="mt-0.5 text-right text-[0.65rem] font-bold text-neutral-500">
            {a.target === 1 ? "Ainda não" : `${formatProgress(a.current)} / ${formatProgress(a.target)}`}
          </p>
        </div>
      ) : null}

      {a.rewards.length || a.realPrize ? (
        <div className="flex flex-wrap gap-1.5 border-t-2 border-dashed border-neutral-300 pt-2">
          <span className="text-[0.6rem] font-extrabold uppercase text-neutral-500">Prêmio:</span>
          {a.rewards.map((r) => (
            <RewardChip key={r.id} item={r} />
          ))}
          {a.realPrize ? (
            <span className="rounded-full border-2 border-[#0a0a0a] bg-[#f5c542] px-2 py-0.5 text-[0.62rem] font-extrabold">
              🎁 {a.realPrize}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function RewardChip({ item }: { item: Item }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border-2 px-2 py-0.5 text-[0.62rem] font-bold"
      style={{ borderColor: RARITY_COLOR[item.rarity] }}
    >
      {item.color ? <span className="size-2.5 rounded-full border border-black/30" style={{ background: item.color }} /> : null}
      {item.name}
    </span>
  );
}

function formatProgress(n: number): string {
  return n >= 1000 ? `${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil` : String(n);
}

/** "Novo item desbloqueado!" chest pop-up. */
export function UnlockModal({ achievement, onClose }: { achievement: AchievementState; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm animate-[pop_.35s_ease-out] rounded-[2rem] border-4 border-[#0a0a0a] bg-white p-6 text-center shadow-[8px_8px_0_#0a0a0a]"
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`@keyframes pop{0%{transform:scale(.6);opacity:0}70%{transform:scale(1.05)}100%{transform:scale(1);opacity:1}}`}</style>
        <p className="text-xs font-extrabold uppercase tracking-widest text-[#b297d3]">Conquista desbloqueada!</p>
        <div className="mx-auto mt-3 flex size-24 items-center justify-center rounded-3xl border-4 border-[#0a0a0a] text-6xl" style={{ background: RARITY_COLOR[achievement.rarity] }}>
          {achievement.emoji}
        </div>
        <p className="mt-3 text-2xl font-black">{achievement.title}</p>
        <p className="text-sm text-neutral-600">{achievement.description}</p>
        <div className="mt-4 rounded-2xl border-[3px] border-dashed border-[#0a0a0a] bg-[#f0eaf6] p-3">
          <p className="text-xs font-extrabold uppercase">Você ganhou</p>
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {achievement.rewards.map((r) => (
              <RewardChip key={r.id} item={r} />
            ))}
            {achievement.realPrize ? (
              <span className="rounded-full border-2 border-[#0a0a0a] bg-[#f5c542] px-2 py-0.5 text-[0.62rem] font-extrabold">
                🎁 {achievement.realPrize}
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-2xl border-4 border-[#0a0a0a] bg-[#fd9fb0] py-3 font-extrabold uppercase shadow-[4px_4px_0_#0a0a0a] active:translate-y-1 active:shadow-none"
        >
          Equipar agora
        </button>
      </div>
    </div>
  );
}
