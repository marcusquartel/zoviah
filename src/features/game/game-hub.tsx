"use client";

import { useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import { AchievementsBoard, LevelBar, UnlockModal } from "@/features/game/achievements-board";
import { collectHennas, markAchievementsSeen, saveAvatar, sendInteraction } from "@/features/game/actions";
import {
  evaluateAchievements,
  sanitizeAvatar,
  unlockedItemIds,
  type AvatarConfig,
  type GameStats,
} from "@/lib/game/catalog";
import type { LiveConfig, LobbyPlayer } from "@/features/game/lobby";
import { makeBots } from "@/features/game/bots";
import { cn } from "@/lib/utils";

// WebGL only in the browser.
const Lobby = dynamic(() => import("@/features/game/lobby").then((m) => m.Lobby), {
  ssr: false,
  loading: () => <Loading />,
});
const AvatarEditor = dynamic(() => import("@/features/game/avatar-editor").then((m) => m.AvatarEditor), {
  ssr: false,
  loading: () => <Loading />,
});

const TABS = [
  { id: "lobby", label: "Glance World", emoji: "🌐" },
  { id: "avatar", label: "Meu avatar", emoji: "🧍‍♀️" },
  { id: "achievements", label: "Conquistas", emoji: "🏆" },
] as const;

/**
 * Game area of the creator portal: Glance World, avatar editor, achievements.
 * `live` connects it to the brand's realtime channel and persists actions;
 * without it (prototype / staff preview) everything stays local.
 */
export function GameHub({
  name,
  stats,
  avatar,
  players,
  live,
  seen,
  readOnly = false,
  demoUnlock,
  botCount = 0,
}: {
  name: string;
  stats: GameStats;
  avatar: Partial<AvatarConfig>;
  players: LobbyPlayer[];
  live?: { creatorId: string; orgId: string };
  /** Achievement ids already shown to her (live). */
  seen?: string[];
  /** Staff preview: no saving, no channel. */
  readOnly?: boolean;
  /** Prototype only: show the unlock pop-up for this achievement. */
  demoUnlock?: string;
  /** Staff load test (?bots=N): simulated visitors, local to this screen. */
  botCount?: number;
}) {
  const bots = useMemo(() => makeBots(botCount), [botCount]);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("lobby");
  const [hennas, setHennas] = useState(stats.hennasCollected);
  const liveStats = useMemo(() => ({ ...stats, hennasCollected: hennas }), [stats, hennas]);
  const list = useMemo(() => evaluateAchievements(liveStats), [liveStats]);
  const unlocked = useMemo(() => unlockedItemIds(liveStats), [liveStats]);
  const [saved, setSaved] = useState(avatar);
  // A saved look can hold items she no longer qualifies for (e.g. last
  // month's crown): wear only what is unlocked now.
  const look = useMemo(() => sanitizeAvatar(saved, unlocked), [saved, unlocked]);
  const lobbyPlayers = useMemo(() => players.map((p) => (p.me ? { ...p, config: look } : p)), [players, look]);
  const [pending, startTransition] = useTransition();

  // New achievements since her last visit → one pop-up at a time.
  const [queue, setQueue] = useState(() => {
    if (demoUnlock) return list.filter((a) => a.id === demoUnlock && a.unlocked);
    if (!seen) return [];
    const known = new Set(seen);
    return list.filter((a) => a.unlocked && !known.has(a.id));
  });
  const popup = queue[0] ?? null;

  function closePopup() {
    const rest = queue.slice(1);
    setQueue(rest);
    if (rest.length === 0) {
      if (live && !readOnly) void markAchievementsSeen(live.creatorId, list.filter((a) => a.unlocked).map((a) => a.id));
      setTab("avatar");
    }
  }

  function onSaveAvatar(config: AvatarConfig) {
    if (!live || readOnly) {
      setSaved(config);
      toast.success("Visual atualizado (prévia).");
      return;
    }
    startTransition(async () => {
      const res = await saveAvatar(live.creatorId, config);
      if (res.ok) {
        setSaved(res.avatar ?? config);
        toast.success("Visual salvo! Todo mundo no Glance World já vê. ✨");
      } else toast.error(res.error ?? "Não foi possível salvar.");
    });
  }

  const lobbyLive: LiveConfig | undefined = useMemo(
    () =>
      live && !readOnly
        ? {
            orgId: live.orgId,
            meId: live.creatorId,
            onInteract: (to, kind) => sendInteraction(live.creatorId, to, kind),
            onCollect: () => {
              setHennas((h) => h + 1);
              void collectHennas(live.creatorId, 1);
            },
          }
        : undefined,
    [live, readOnly],
  );

  return (
    <div className="relative space-y-4" style={{ fontFamily: "var(--font-game), system-ui, sans-serif" }}>
      <LevelBar list={list} name={name} />

      <nav className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-1 rounded-2xl border-4 border-[#0a0a0a] px-3 py-2.5 text-xs font-extrabold uppercase transition-transform active:translate-y-1 sm:flex-none sm:px-6 sm:text-sm",
              tab === t.id ? "bg-[#fd9fb0] shadow-[4px_4px_0_#0a0a0a]" : "bg-white",
            )}
          >
            <span aria-hidden>{t.emoji}</span> {t.label}
          </button>
        ))}
      </nav>

      {/* Hidden without display:none — a zero-size canvas makes drei <Html> rebuild its labels. */}
      <div
        aria-hidden={tab !== "lobby"}
        className={tab === "lobby" ? undefined : "pointer-events-none absolute inset-x-0 top-0 -z-10 opacity-0"}
      >
        <Lobby players={lobbyPlayers} active={tab === "lobby"} live={lobbyLive} bots={bots} />
      </div>
      {tab === "avatar" ? (
        <div className={pending ? "pointer-events-none opacity-70" : undefined}>
          <AvatarEditor key={JSON.stringify(look)} initial={look} unlocked={unlocked} onSave={readOnly ? undefined : onSaveAvatar} />
        </div>
      ) : null}
      {tab === "achievements" ? <AchievementsBoard list={list} /> : null}

      {popup ? <UnlockModal achievement={popup} onClose={closePopup} /> : null}
    </div>
  );
}

function Loading() {
  return (
    <div className="flex h-[420px] items-center justify-center rounded-3xl border-4 border-[#0a0a0a] bg-[#def8f7] text-sm font-extrabold">
      Carregando o Glance World…
    </div>
  );
}
