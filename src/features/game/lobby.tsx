"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Html, Sparkles, Stats } from "@react-three/drei";
import { Vector3, type Group, type Mesh, type MeshBasicMaterial } from "three";
import { BlockAvatar, LowAvatar, type Emote } from "@/features/game/block-avatar";
import { Billboards } from "@/features/game/billboards";
import { WORLD_SCALE } from "@/features/game/world";
import { playPickup } from "@/features/game/sfx";
import { BrowBrush, CareBottle, HennaBottle, HennaBox, LaminationTube, ProductIsland } from "@/features/game/products";
import { ITEM_BY_ID, type AvatarConfig } from "@/lib/game/catalog";
import { createClient } from "@/lib/supabase/client";

/**
 * GLANCE WORLD — the creators' 3D lobby.
 *
 * Demo mode (no `live`): the other creators are simulated.
 * Live mode: a private Realtime channel per brand ("glance-world:<org>")
 * carries presence (who is online), positions, emotes, phrases and
 * interactions. Interactions are persisted through `live.onInteract`
 * (rate-limited RPC) before being broadcast.
 */

export interface LiveConfig {
  orgId: string;
  meId: string;
  onInteract: (to: string, kind: "clap" | "heart" | "wave") => Promise<{ ok: boolean; error?: string }>;
  /** Points of the henna picked up (1, 2 or 5). */
  onCollect: (points: number) => void;
}

type Remote = { x: number; z: number; ry: number; walking: boolean };

export interface LobbyPlayer {
  id: string;
  name: string;
  tier: string | null;
  /** Month ranking position (only when she sold this month). */
  position: number | null;
  /** Achievements count, when known (prototype). */
  badges?: number;
  config: AvatarConfig;
  me?: boolean;
}

type Input = { x: number; z: number };
type Reaction = { emote: Emote; text?: string; until: number };
type FeedItem = { id: number; text: string };

export const PHRASES = [
  "Parabéns! 🎉",
  "Bora vender! 🚀",
  "Amei seu look! 💜",
  "Arrasou no conteúdo! 📸",
  "Bem-vinda! 👋",
  "Obrigada! 💜",
  "Vamos juntas! 🤝",
  "Que henna linda! 🤎",
];

const EMOTES: { id: Exclude<Emote, null>; emoji: string; label: string }[] = [
  { id: "wave", emoji: "👋", label: "Acenar" },
  { id: "dance", emoji: "💃", label: "Dançar" },
  { id: "clap", emoji: "👏", label: "Aplaudir" },
  { id: "heart", emoji: "💜", label: "Coração" },
];
const EMOTE_EMOJI: Record<Exclude<Emote, null>, string> = { wave: "👋", dance: "💃", clap: "👏", heart: "💜" };

const K = WORLD_SCALE;
const WORLD_RADIUS = 19 * K;
// Stable references: drei <Html> rebuilds its DOM root when these change.
const Z_LABELS: [number, number] = [5, 0];
const Z_TAGS: [number, number] = [10, 0];
const PODIUM = [
  { place: 1, x: 0, h: 1.4, color: "#f5c542" },
  { place: 2, x: -2.3, h: 1.0, color: "#c1acdc" },
  { place: 3, x: 2.3, h: 0.7, color: "#fd9fb0" },
];
/** Henna types: points, look and respawn time. */
const HENNA = {
  1: { label: "Henna", respawn: 25_000 },
  2: { label: "Henna 2x", respawn: 40_000 },
  5: { label: "Henna Dourada 5x", respawn: 75_000 },
} as const;
type HennaValue = keyof typeof HENNA;

const COLLECTIBLES: [number, number, HennaValue][] = (
  [
    [-6, 7, 1], [5, 7, 1], [-12, -2, 2], [12, 1, 1], [-3, -9, 1], [4, -8, 2], [-15, 6, 1], [14, -4, 1], [0, 15, 2], [-7, -14, 5],
    [-9, 12, 1], [9, 12, 2], [16, 9, 1], [-16, -8, 2], [7, -15, 1], [-1, -16, 1], [15, -11, 5], [-13, 13, 1], [3, 3.5, 1], [-3.5, 3, 1],
  ] as [number, number, HennaValue][]
).map(([x, z, v]) => [x * K, z * K, v]);

const now = () => performance.now();
const pick = <T,>(list: T[]): T | undefined => list[Math.floor(Math.random() * list.length)];

export function Lobby({
  players,
  active = true,
  live,
  bots = [],
}: {
  players: LobbyPlayer[];
  active?: boolean;
  live?: LiveConfig;
  /** Load test: local-only simulated visitors (never sent to the channel). */
  bots?: LobbyPlayer[];
}) {
  const input = useRef<Input>({ x: 0, z: 0 });
  const [selected, setSelected] = useState<LobbyPlayer | null>(null);
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [collected, setCollected] = useState(0);
  const [taken, setTaken] = useState<Record<number, number>>({});
  const [phrasesOpen, setPhrasesOpen] = useState(false);
  const feedId = useRef(0);
  const [online, setOnline] = useState<Set<string>>(() => new Set());
  const remote = useRef<Record<string, Remote>>({});
  const [lod] = useState(() => new Lod());
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  const setInput = useCallback((v: Input) => {
    input.current = v;
  }, []);
  useKeyboard(setInput);

  const me = players.find((p) => p.me) ?? null;
  const others = useMemo(() => players.filter((p) => !p.me), [players]);
  const podiumIds = useMemo(
    () => new Set(others.filter((p) => p.position != null && p.position <= 3).map((p) => p.id)),
    [others],
  );
  // Live: a podium creator who is online walks around instead of standing on it.
  const podiumPlayers = useMemo(
    () => (live ? others.filter((p) => !online.has(p.id)) : others),
    [live, others, online],
  );
  const wanderers = useMemo(
    () => others.filter((p) => !podiumIds.has(p.id) || (live && online.has(p.id))),
    [others, podiumIds, live, online],
  );
  const nameOf = useCallback((id: string) => players.find((p) => p.id === id)?.name ?? "Alguém", [players]);

  const react = useCallback((id: string, r: Omit<Reaction, "until">, ms = 3500) => {
    setReactions((prev) => ({ ...prev, [id]: { ...r, until: now() + ms } }));
  }, []);
  const pushFeed = useCallback((text: string) => {
    const id = ++feedId.current;
    setFeed((f) => [{ id, text }, ...f].slice(0, 4));
  }, []);

  const broadcast = useCallback((event: string, payload: Record<string, unknown>) => {
    void channelRef.current?.send({ type: "broadcast", event, payload });
  }, []);

  // Live channel.
  useEffect(() => {
    if (!live) return;
    const supabase = createClient();
    const channel = supabase.channel(`glance-world:${live.orgId}`, {
      config: { private: true, presence: { key: live.meId }, broadcast: { self: false } },
    });
    channelRef.current = channel;
    channel
      .on("presence", { event: "sync" }, () => {
        setOnline(new Set(Object.keys(channel.presenceState()).filter((id) => id !== live.meId)));
      })
      .on("broadcast", { event: "move" }, ({ payload }) => {
        const p = payload as Remote & { id: string };
        if (p?.id && p.id !== live.meId) remote.current[p.id] = { x: p.x, z: p.z, ry: p.ry, walking: p.walking };
      })
      .on("broadcast", { event: "react" }, ({ payload }) => {
        const p = payload as { id: string; emote: Emote; text?: string; ms?: number };
        if (p?.id) react(p.id, { emote: p.emote ?? null, text: p.text }, Math.min(p.ms ?? 3500, 6000));
      })
      .on("broadcast", { event: "interact" }, ({ payload }) => {
        const p = payload as { from: string; to: string; kind: "clap" | "heart" | "wave" };
        if (!p?.from || !p.to) return;
        const emoji = EMOTE_EMOJI[p.kind];
        react(p.from, { emote: p.kind });
        react(p.to, { emote: null, text: emoji }, 2200);
        if (p.to === live.meId) {
          const verb = { clap: "te aplaudiu", heart: "te mandou carinho", wave: "acenou para você" }[p.kind];
          pushFeed(`${nameOf(p.from)} ${verb} ${emoji}`);
        }
      });
    let cancelled = false;
    void supabase.realtime.setAuth().then(() => {
      if (cancelled) return;
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ id: live.meId, at: Date.now() });
      });
    });
    return () => {
      cancelled = true;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [live, react, pushFeed, nameOf]);

  // Load test: the simulated crowd emotes and talks (local only).
  useEffect(() => {
    if (!active || bots.length === 0) return;
    const timer = setInterval(() => {
      for (let n = 0; n < 3; n++) {
        const b = bots[Math.floor(Math.random() * bots.length)];
        if (Math.random() < 0.5) react(b.id, { emote: EMOTES[Math.floor(Math.random() * EMOTES.length)].id });
        else react(b.id, { emote: null, text: PHRASES[Math.floor(Math.random() * PHRASES.length)] });
      }
    }, 700);
    return () => clearInterval(timer);
  }, [active, bots, react]);

  // Demo only: a simulated community that emotes, talks and cheers you.
  useEffect(() => {
    if (live || !active || others.length === 0) return;
    const timer = setInterval(() => {
      const p = others[Math.floor(Math.random() * others.length)];
      const roll = Math.random();
      if (roll < 0.4) {
        const e = EMOTES[Math.floor(Math.random() * EMOTES.length)];
        react(p.id, { emote: e.id });
      } else if (roll < 0.75) {
        react(p.id, { emote: null, text: PHRASES[Math.floor(Math.random() * 5)] });
      } else if (me) {
        const clap = Math.random() < 0.5;
        react(p.id, { emote: clap ? "clap" : "heart" });
        react(me.id, { emote: null, text: clap ? "👏" : "💜" }, 2000);
        pushFeed(`${p.name} ${clap ? "te aplaudiu 👏" : "te mandou carinho 💜"}`);
      }
    }, 4200);
    return () => clearInterval(timer);
  }, [live, active, others, me, react, pushFeed]);

  function myEmote(e: Exclude<Emote, null>) {
    if (!me) return;
    react(me.id, { emote: e, text: EMOTE_EMOJI[e] });
    broadcast("react", { id: me.id, emote: e, text: EMOTE_EMOJI[e] });
  }
  function myPhrase(text: string) {
    if (!me) return;
    setPhrasesOpen(false);
    react(me.id, { emote: null, text }, 4500);
    if (live) {
      broadcast("react", { id: me.id, emote: null, text, ms: 4500 });
      return;
    }
    const p = pick(others);
    if (p) setTimeout(() => react(p.id, { emote: "wave", text: "💜" }), 1400);
  }
  async function interact(target: LobbyPlayer, kind: "clap" | "heart" | "wave") {
    if (!me) return;
    const verb = { clap: "aplaudiu", heart: "mandou carinho para", wave: "acenou para" }[kind];
    if (live) {
      const res = await live.onInteract(target.id, kind);
      if (!res.ok) {
        pushFeed(res.error ?? "Não foi possível enviar.");
        return;
      }
      broadcast("interact", { from: me.id, to: target.id, kind });
    }
    react(me.id, { emote: kind, text: EMOTE_EMOJI[kind] });
    react(target.id, { emote: null, text: EMOTE_EMOJI[kind] }, 2200);
    pushFeed(`Você ${verb} ${target.name}`);
    if (!live) {
      setTimeout(() => {
        react(target.id, { emote: "heart", text: "Obrigada! 💜" });
        pushFeed(`${target.name} agradeceu 💜`);
      }, 1500);
    }
  }
  const onCollect = live?.onCollect;
  const [bursts, setBursts] = useState<Burst[]>([]);
  const burstId = useRef(0);
  // Synchronous guard: the player's frame loop can report the same henna
  // again before the `taken` state re-renders — count it only once.
  const takenUntil = useRef<Record<number, number>>({});
  const collect = useCallback(
    (i: number) => {
      const [x, z, value] = COLLECTIBLES[i];
      if ((takenUntil.current[i] ?? 0) > now()) return;
      const until = now() + HENNA[value].respawn;
      takenUntil.current[i] = until;
      setTaken((t) => (t[i] ? t : { ...t, [i]: until }));
      setCollected((c) => c + value);
      playPickup(value);
      const id = ++burstId.current;
      setBursts((b) => [...b.slice(-5), { id, x, z, value }]);
      setTimeout(() => setBursts((b) => b.filter((x) => x.id !== id)), 1400);
      if (value > 1) pushFeed(value === 5 ? "✨ HENNA DOURADA! +5 ✨" : "💜 Henna 2x! +2");
      onCollect?.(value);
    },
    [onCollect, pushFeed],
  );
  const onMove = useCallback(
    (m: Remote) => {
      if (me) broadcast("move", { id: me.id, ...m });
    },
    [broadcast, me],
  );
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      setTaken((prev) => {
        const next = Object.fromEntries(Object.entries(prev).filter(([, until]) => until > now()));
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 2000);
    return () => clearInterval(t);
  }, [active]);

  return (
    <div className="relative h-[580px] w-full overflow-hidden rounded-3xl border-4 border-[#0a0a0a] bg-[#bdf1ef] shadow-[6px_6px_0_#0a0a0a] sm:h-[640px]">
      {/* Paused (not unmounted) while hidden: keeps the scene and stops rendering. */}
      <Canvas shadows camera={{ position: [0, 9, 16], fov: 45 }} dpr={[1, 1.75]} frameloop={active ? "always" : "never"}>
        <color attach="background" args={["#def8f7"]} />
        <fog attach="fog" args={["#def8f7", 30 * K, 60 * K]} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 18, 8]} intensity={1.5} castShadow shadow-mapSize={[1024, 1024]} />
        <World />
        <Podium players={podiumPlayers} reactions={reactions} onSelect={setSelected} />
        {wanderers.map((p, i) =>
          live ? (
            <RemotePlayer
              key={p.id}
              player={p}
              seed={i}
              online={online.has(p.id)}
              remote={remote}
              reaction={reactions[p.id]}
              onSelect={setSelected}
              lod={lod}
            />
          ) : (
            <Wanderer key={p.id} player={p} seed={i} reaction={reactions[p.id]} onSelect={setSelected} lod={lod} />
          ),
        )}
        {bots.map((p, i) => (
          <Wanderer key={p.id} player={p} seed={i + 1000} reaction={reactions[p.id]} onSelect={setSelected} lod={lod} />
        ))}
        <LodManager lod={lod} />
        {bots.length > 0 ? <Stats /> : null}
        <Collectibles taken={taken} />
        {bursts.map((b) => (
          <PickupBurst key={b.id} burst={b} />
        ))}
        {me ? (
          <Player
            me={me}
            input={input}
            reaction={reactions[me.id]}
            taken={taken}
            onCollect={collect}
            onMove={live ? onMove : undefined}
          />
        ) : null}
        <ContactShadows position={[0, 0.01, 0]} opacity={0.3} scale={44} blur={2} far={6} />
      </Canvas>

      {/* HUD */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col gap-2">
        <div className="rounded-2xl border-[3px] border-[#0a0a0a] bg-[#0a0a0a] px-3 py-2 text-white shadow-[3px_3px_0_#fd9fb0]">
          <p className="text-sm font-black tracking-wider">GLANCE WORLD</p>
          <p className="text-[0.65rem] font-semibold text-white/70">
            {live ? `${online.size + 1} online agora · ${players.length} embaixadoras` : `${players.length} embaixadoras`} · WASD / setas ou joystick
          </p>
        </div>
        <div className="w-fit rounded-2xl border-[3px] border-[#0a0a0a] bg-white px-3 py-1.5 text-xs font-extrabold shadow-[3px_3px_0_#0a0a0a]">
          🤎 Hennas coletadas: {collected}
        </div>
      </div>

      {feed.length ? (
        <ul className="pointer-events-none absolute right-3 top-3 z-20 flex w-56 flex-col gap-1.5">
          {feed.map((f) => (
            <li key={f.id} className="rounded-xl border-2 border-[#0a0a0a] bg-white/95 px-2.5 py-1.5 text-[0.7rem] font-bold shadow-[2px_2px_0_#0a0a0a]">
              {f.text}
            </li>
          ))}
        </ul>
      ) : null}

      <Joystick onInput={setInput} />

      <div className="absolute bottom-4 right-3 z-20 flex flex-col items-end gap-2">
        {phrasesOpen ? (
          <div className="grid w-60 grid-cols-1 gap-1 rounded-2xl border-[3px] border-[#0a0a0a] bg-white p-2 shadow-[3px_3px_0_#0a0a0a]">
            {PHRASES.map((ph) => (
              <button
                key={ph}
                type="button"
                onClick={() => myPhrase(ph)}
                className="rounded-lg px-2 py-1.5 text-left text-xs font-bold hover:bg-[#f0eaf6]"
              >
                {ph}
              </button>
            ))}
          </div>
        ) : null}
        <div className="flex gap-1.5">
          {EMOTES.map((e) => (
            <button
              key={e.id}
              type="button"
              title={e.label}
              aria-label={e.label}
              onClick={() => myEmote(e.id)}
              className="flex size-11 items-center justify-center rounded-2xl border-[3px] border-[#0a0a0a] bg-white text-xl shadow-[3px_3px_0_#0a0a0a] active:translate-y-0.5 active:shadow-none"
            >
              {e.emoji}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPhrasesOpen((o) => !o)}
            className="flex h-11 items-center gap-1 rounded-2xl border-[3px] border-[#0a0a0a] bg-[#fd9fb0] px-3 text-sm font-extrabold shadow-[3px_3px_0_#0a0a0a] active:translate-y-0.5 active:shadow-none"
          >
            💬 Falar
          </button>
        </div>
      </div>

      {selected ? (
        <PlayerCard
          player={selected}
          onClose={() => setSelected(null)}
          onInteract={(kind) => {
            void interact(selected, kind);
            setSelected(null);
          }}
        />
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------- world

function World() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[WORLD_RADIUS + 3, 64]} />
        <meshStandardMaterial color="#f7f5fb" />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, (i * Math.PI) / 6]} position={[0, 0.005, 0]} receiveShadow>
          <ringGeometry args={[6, WORLD_RADIUS, 6, 1, 0, Math.PI / 6]} />
          <meshStandardMaterial color={i % 2 ? "#f0eaf6" : "#e0d5ed"} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <circleGeometry args={[5.5, 48]} />
        <meshStandardMaterial color="#c1acdc" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[WORLD_RADIUS + 2.6, WORLD_RADIUS + 3, 64]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>

      <WorldSign />
      <Billboards />

      <Arch position={[-13 * K, 0, -12 * K]} color="#fd9fb0" rotation={0.8} />
      <Arch position={[13 * K, 0, -12 * K]} color="#59dbd6" rotation={-0.8} />
      <mesh position={[-15 * K, 2, -14 * K]} castShadow>
        <sphereGeometry args={[2, 32, 32]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      <mesh position={[18 * K, 1.6, 4 * K]} rotation={[0, 0.4, 0]} castShadow>
        <coneGeometry args={[2.2, 3.4, 3]} />
        <meshStandardMaterial color="#59dbd6" />
      </mesh>

      {/* Glance landmarks */}
      <HennaBottle position={[-18 * K, 0, 7 * K]} scale={3.2} rotation={0.4} />
      <HennaBottle position={[10 * K, 0, -16 * K]} scale={2.4} rotation={-0.3} />
      <HennaBottle position={[18 * K, 0, 8 * K]} scale={2.8} />
      <CareBottle position={[-17 * K, 0, -6 * K]} color="#c1acdc" scale={2.6} />
      <CareBottle position={[-15 * K, 0, -9.5 * K]} color="#59dbd6" scale={2.1} />
      <CareBottle position={[16 * K, 0, -9 * K]} color="#fd9fb0" scale={2.4} />
      <CareBottle position={[18 * K, 0, -2 * K]} color="#f2a65a" scale={1.9} />
      <BrowBrush position={[-6 * K, 0, -16 * K]} rotation={0.3} scale={1.4} />
      <BrowBrush position={[16 * K, 0, -14 * K]} rotation={-0.5} scale={1.2} />
      <LaminationTube position={[-3 * K, 0.3, -16 * K]} rotation={0.8} scale={1.6} />
      <LaminationTube position={[-17 * K, 0.3, 11 * K]} rotation={-0.4} scale={1.4} />

      <group position={[-17 * K, 0, -1 * K]}>
        <HennaBox position={[0, 0, 0]} scale={1.5} rotation={0.2} />
        <HennaBox position={[1.6, 0, 0.4]} scale={1.5} rotation={-0.3} />
        <HennaBox position={[0.8, 1.05, 0.2]} scale={1.5} rotation={0.6} />
      </group>
      <group position={[12 * K, 0, 8 * K]}>
        <HennaBox position={[0, 0, 0]} scale={1.3} rotation={-0.5} />
        <HennaBox position={[0.2, 0.9, 0.1]} scale={1.3} rotation={0.2} />
      </group>

      <ProductIsland position={[-9 * K, 0, 3 * K]} rotation={0.4} />
      <ProductIsland position={[9 * K, 0, 1 * K]} rotation={-0.6} />
      <ProductIsland position={[0 * K, 0, -12 * K]} rotation={0} />

      {/* outer ring (bigger map) */}
      <ProductIsland position={[-20, 0, 22]} rotation={0.9} />
      <ProductIsland position={[22, 0, 20]} rotation={-0.3} />
      <ProductIsland position={[-26, 0, -14]} rotation={1.4} />
      <ProductIsland position={[27, 0, -12]} rotation={-1.1} />
      <ProductIsland position={[0, 0, 30]} rotation={0.2} />
      <HennaBottle position={[-30, 0, 4]} scale={3} rotation={0.2} />
      <HennaBottle position={[31, 0, 2]} scale={3.2} />
      <CareBottle position={[-8, 0, 33]} color="#fd9fb0" scale={2.4} />
      <CareBottle position={[9, 0, 33]} color="#59dbd6" scale={2.2} />
      <Arch position={[-24, 0, 6]} color="#c1acdc" rotation={1.5} />
      <Arch position={[24, 0, 6]} color="#fd9fb0" rotation={-1.5} />
    </group>
  );
}

/** Entrance sign: GLANCE WORLD on a black slab between two giant hennas. */
function WorldSign() {
  return (
    <group position={[0, 0, -18 * K]}>
      <mesh position={[0, 4.4, 0]} castShadow>
        <boxGeometry args={[11, 2.4, 0.6]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      <HennaBottle position={[-6.4, 0, 0]} scale={3.6} />
      <HennaBottle position={[6.4, 0, 0]} scale={3.6} />
      <Html position={[0, 4.4, 0.33]} center transform distanceFactor={9} pointerEvents="none" zIndexRange={Z_LABELS}>
        <div className="select-none text-center leading-none">
          <div className="text-[52px] font-black tracking-[0.12em] text-white">GLANCE WORLD</div>
          <div className="mt-1 text-[13px] font-bold tracking-[0.4em] text-[#fd9fb0]">BY RARE WAY</div>
        </div>
      </Html>
      <Sparkles count={40} scale={[12, 4, 2]} position={[0, 4.4, 0.6]} size={6} speed={0.4} color="#f5c542" />
    </group>
  );
}

function Arch({ position, color, rotation }: { position: [number, number, number]; color: string; rotation: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 3, 0]} castShadow>
        <torusGeometry args={[2, 0.45, 16, 32, Math.PI]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-2, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.45, 3, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[2, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.45, 3, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
    </group>
  );
}

/** Floating mini hennas to collect: 1 point, 2x (lilac halo) and 5x (golden beam). */
function Collectibles({ taken }: { taken: Record<number, number> }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    group.current?.children.forEach((c, i) => {
      const value = COLLECTIBLES[i][2];
      c.rotation.y = t * (value === 5 ? 2.4 : 1.5) + i;
      c.position.y = 0.6 + Math.sin(t * 2 + i) * 0.2;
      if (value === 5) c.scale.setScalar(1 + Math.sin(t * 5) * 0.08);
    });
  });
  return (
    <group ref={group}>
      {COLLECTIBLES.map(([x, z, value], i) => (
        <group key={i} position={[x, 0.6, z]} visible={!taken[i]}>
          {value === 5 ? <GoldenHenna /> : value === 2 ? <DoubleHenna /> : <HennaBottle scale={0.55} />}
          {value === 1 ? (
            <Sparkles count={8} scale={1.2} position={[0, 0.4, 0]} size={4} speed={0.5} color="#f5c542" />
          ) : null}
        </group>
      ))}
    </group>
  );
}

/** 2 points: lilac glowing bottle with a halo and a short beam. */
function DoubleHenna() {
  return (
    <group>
      <group scale={0.75}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 1, 20]} />
          <meshStandardMaterial color="#b89ce0" metalness={0.5} roughness={0.25} emissive="#957db2" emissiveIntensity={0.8} />
        </mesh>
        <mesh position={[0, 1.25, 0]}>
          <cylinderGeometry args={[0.24, 0.24, 0.32, 16]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
      </group>
      <mesh position={[0, 0.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.75, 0.08, 8, 36]} />
        <meshStandardMaterial color="#c1acdc" emissive="#a08ad0" emissiveIntensity={1.6} />
      </mesh>
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[0.25, 0.65, 6, 16, 1, true]} />
        <meshBasicMaterial color="#a08ad0" transparent opacity={0.25} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 1, 0]} color="#c1acdc" intensity={4} distance={5} />
      <Sparkles count={16} scale={[1.8, 2.4, 1.8]} position={[0, 0.8, 0]} size={7} speed={0.9} color="#957db2" />
    </group>
  );
}

/** 5 points: golden bottle, double ring and a beam of light you can spot from afar. */
function GoldenHenna() {
  return (
    <group>
      <group scale={0.85}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <cylinderGeometry args={[0.32, 0.32, 1, 20]} />
          <meshStandardMaterial color="#f5c542" metalness={0.8} roughness={0.2} emissive="#b8860b" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0, 1.25, 0]}>
          <cylinderGeometry args={[0.24, 0.24, 0.32, 16]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
      </group>
      <mesh position={[0, 0.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.85, 0.07, 8, 40]} />
        <meshStandardMaterial color="#f5c542" emissive="#f5c542" emissiveIntensity={1.5} />
      </mesh>
      <mesh position={[0, 0.5, 0]} rotation={[0.4, 0, 0.9]}>
        <torusGeometry args={[1.05, 0.05, 8, 40]} />
        <meshStandardMaterial color="#fd9fb0" emissive="#fd9fb0" emissiveIntensity={1.2} />
      </mesh>
      <mesh position={[0, 5, 0]}>
        <cylinderGeometry args={[0.35, 0.9, 10, 16, 1, true]} />
        <meshBasicMaterial color="#f5c542" transparent opacity={0.16} depthWrite={false} />
      </mesh>
      <pointLight position={[0, 1, 0]} color="#f5c542" intensity={6} distance={6} />
      <Sparkles count={24} scale={[2.2, 3, 2.2]} position={[0, 1, 0]} size={8} speed={1.2} color="#f5c542" />
    </group>
  );
}

type Burst = { id: number; x: number; z: number; value: HennaValue };
const BURST_COLORS = { 1: ["#f5c542", "#7a3f17"], 2: ["#c1acdc", "#fd9fb0"], 5: ["#f5c542", "#fd9fb0", "#59dbd6"] } as const;

/** Pickup feedback: confetti cubes, an expanding ring and a floating "+N". */
function PickupBurst({ burst }: { burst: Burst }) {
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const age = useRef(0);
  const pieces = useMemo(() => {
    const n = burst.value === 5 ? 28 : burst.value === 2 ? 16 : 9;
    const colors = BURST_COLORS[burst.value];
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      const up = 2.5 + ((i * 7) % 5) * 0.6;
      return { dir: [Math.cos(a), up, Math.sin(a)] as const, color: colors[i % colors.length] };
    });
  }, [burst.value]);
  useFrame((_, dt) => {
    age.current += dt;
    const t = age.current;
    group.current?.children.forEach((c, i) => {
      const d = pieces[i]?.dir;
      if (!d) return;
      const speed = burst.value === 5 ? 3.2 : 2.2;
      c.position.set(d[0] * speed * t, 0.8 + d[1] * t - 4.5 * t * t, d[2] * speed * t);
      c.rotation.set(t * 8, t * 6, 0);
      c.scale.setScalar(Math.max(0, 1 - t / 1.2));
    });
    if (ring.current) {
      const s = 0.5 + t * (burst.value === 5 ? 6 : 3.5);
      ring.current.scale.set(s, s, s);
      (ring.current.material as MeshBasicMaterial).opacity = Math.max(0, 0.7 - t * 0.7);
    }
  });
  return (
    <group position={[burst.x, 0, burst.z]}>
      <group ref={group}>
        {pieces.map((p, i) => (
          <mesh key={i}>
            <boxGeometry args={[0.16, 0.16, 0.16]} />
            <meshBasicMaterial color={p.color} />
          </mesh>
        ))}
      </group>
      <mesh ref={ring} position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1, 40]} />
        <meshBasicMaterial color={BURST_COLORS[burst.value][0]} transparent opacity={0.7} depthWrite={false} />
      </mesh>
      <Html position={[0, 3.2, 0]} center pointerEvents="none" zIndexRange={Z_TAGS}>
        <div
          className="select-none whitespace-nowrap font-black"
          style={{
            animation: "henna-pop 1.3s ease-out forwards",
            fontSize: burst.value === 5 ? 34 : burst.value === 2 ? 26 : 20,
            color: burst.value === 5 ? "#f5c542" : burst.value === 2 ? "#957db2" : "#7a3f17",
            WebkitTextStroke: "2px #0a0a0a",
          }}
        >
          <style>{`@keyframes henna-pop{0%{transform:translateY(10px) scale(.4);opacity:0}20%{transform:translateY(0) scale(1.15);opacity:1}100%{transform:translateY(-40px) scale(1);opacity:0}}`}</style>
          +{burst.value}
        </div>
      </Html>
    </group>
  );
}

// -------------------------------------------------------------- characters

function Bubble({ reaction }: { reaction?: Reaction }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!reaction) return;
    const ms = reaction.until - now();
    if (ms <= 0) return;
    const t = setTimeout(() => force((n) => n + 1), ms + 50);
    return () => clearTimeout(t);
  }, [reaction]);
  if (!reaction || reaction.until < now() || !reaction.text) return null;
  return (
    <div className="mb-1 max-w-44 animate-[bubble_.25s_ease-out] rounded-2xl border-2 border-[#0a0a0a] bg-white px-2.5 py-1 text-center text-[13px] font-extrabold shadow-[2px_2px_0_#0a0a0a]">
      <style>{`@keyframes bubble{0%{transform:scale(.5);opacity:0}100%{transform:scale(1);opacity:1}}`}</style>
      {reaction.text}
    </div>
  );
}

function NameTag({ player, reaction, online }: { player: LobbyPlayer; reaction?: Reaction; online?: boolean }) {
  const title = ITEM_BY_ID.get(player.config.title);
  return (
    <Html position={[0, 4.1, 0]} center distanceFactor={11} pointerEvents="none" zIndexRange={Z_TAGS}>
      <div className="flex select-none flex-col items-center gap-0.5 whitespace-nowrap">
        <Bubble reaction={reaction} />
        {title && title.id !== "title-none" ? (
          <span className="rounded-full bg-[#0a0a0a] px-2 py-0.5 text-[11px] font-extrabold text-[#f5c542]">{title.name}</span>
        ) : null}
        <span
          className="rounded-lg border-2 border-[#0a0a0a] px-2 py-0.5 text-[13px] font-extrabold"
          style={{ background: player.me ? "#59dbd6" : "#ffffff" }}
        >
          {online ? <span className="mr-1 inline-block size-2 rounded-full bg-[#22c55e] align-middle" /> : null}
          {player.me ? `${player.name} (você)` : player.name}
        </span>
      </div>
    </Html>
  );
}

const activeEmote = (r?: Reaction): Emote => (r && r.until > now() ? r.emote : null);

function Podium({
  players,
  reactions,
  onSelect,
}: {
  players: LobbyPlayer[];
  reactions: Record<string, Reaction>;
  onSelect: (p: LobbyPlayer) => void;
}) {
  const top = PODIUM.map((spot) => ({ spot, player: players.find((p) => p.position === spot.place) ?? null }));
  return (
    <group position={[0, 0, -2.5]}>
      {top.map(({ spot, player }) => (
        <group key={spot.place} position={[spot.x, 0, 0]}>
          <mesh position={[0, spot.h / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[2, spot.h, 2]} />
            <meshStandardMaterial color={spot.color} />
          </mesh>
          <Html position={[0, spot.h / 2, 1.01]} center transform distanceFactor={6} pointerEvents="none" zIndexRange={Z_LABELS}>
            <span className="select-none text-[34px] font-black text-[#0a0a0a]">{spot.place}º</span>
          </Html>
          {player ? (
            <group position={[0, spot.h, 0]} onClick={(e) => (e.stopPropagation(), onSelect(player))}>
              <BlockAvatar config={player.config} scale={0.75} emote={activeEmote(reactions[player.id])} />
              <NameTag player={player} reaction={reactions[player.id]} />
            </group>
          ) : null}
        </group>
      ))}
    </group>
  );
}

/**
 * Level of detail for crowds: only the NEAR_BUDGET people closest to the
 * camera get the full avatar and name tag; everyone else is a 4-box avatar.
 * A single manager ranks distances a few times per second.
 */
const NEAR_BUDGET = 30;

class Lod {
  private groups = new Map<string, Group>();
  private near = new Set<string>();
  private acc = 1;
  register(id: string, g: Group) {
    this.groups.set(id, g);
  }
  unregister(id: string) {
    this.groups.delete(id);
  }
  isNear(id: string) {
    return this.near.has(id);
  }
  tick(camera: { position: Vector3 }, dt: number) {
    this.acc += dt;
    if (this.acc < 0.25) return;
    this.acc = 0;
    const ranked: [string, number][] = [];
    for (const [id, g] of this.groups) ranked.push([id, camera.position.distanceToSquared(g.position)]);
    ranked.sort((a, b) => a[1] - b[1]);
    this.near = new Set(ranked.slice(0, NEAR_BUDGET).map(([id]) => id));
  }
}

function LodManager({ lod }: { lod: Lod }) {
  useFrame(({ camera }, dt) => lod.tick(camera, dt));
  return null;
}

function useNear(ref: React.RefObject<Group | null>, id: string, lod: Lod) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    if (ref.current) lod.register(id, ref.current);
    return () => lod.unregister(id);
  }, [id, lod, ref]);
  useFrame(() => {
    const next = lod.isNear(id);
    if (next !== near) setNear(next);
  });
  return near;
}

/** A simulated creator strolling around the plaza. */
// Memoized: a reaction re-renders only the avatar it belongs to, not the crowd.
const Wanderer = memo(function Wanderer({
  player,
  seed,
  reaction,
  onSelect,
  lod,
}: {
  player: LobbyPlayer;
  seed: number;
  reaction?: Reaction;
  onSelect: (p: LobbyPlayer) => void;
  lod: Lod;
}) {
  const ref = useRef<Group>(null);
  const near = useNear(ref, player.id, lod);
  const [walking, setWalking] = useState(false);
  const state = useRef({ target: new Vector3(), wait: 1 + (seed % 4) });
  const start = useMemo(() => {
    const a = seed * 1.7 + 0.5;
    const r = 7 + ((seed * 37) % 100) / 100 * (WORLD_RADIUS - 10);
    return [Math.sin(a) * r, 0, Math.cos(a) * r] as [number, number, number];
  }, [seed]);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const s = state.current;
    const busy = activeEmote(reaction) != null;
    if (s.wait > 0 || busy) {
      s.wait -= dt;
      if (walking) setWalking(false);
      if (s.wait <= 0 && !busy) {
        const a = Math.random() * Math.PI * 2;
        const r = 7 + Math.random() * (WORLD_RADIUS - 10);
        s.target.set(Math.sin(a) * r, 0, Math.cos(a) * r);
      }
      return;
    }
    const dx = s.target.x - g.position.x;
    const dz = s.target.z - g.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.3) {
      s.wait = 2 + Math.random() * 4;
      return;
    }
    if (!walking) setWalking(true);
    const step = Math.min(dist, 2.6 * Math.min(dt, 0.05));
    g.position.x += (dx / dist) * step;
    g.position.z += (dz / dist) * step;
    g.rotation.y = Math.atan2(dx, dz);
  });

  return (
    <group ref={ref} position={start} onClick={(e) => (e.stopPropagation(), onSelect(player))}>
      {near ? (
        <>
          <BlockAvatar config={player.config} walking={walking} scale={0.75} emote={activeEmote(reaction)} />
          <NameTag player={player} reaction={reaction} />
        </>
      ) : (
        <LowAvatar config={player.config} scale={0.75} />
      )}
    </group>
  );
});

/** Another creator in live mode: idle in her spot until she moves online. */
const RemotePlayer = memo(function RemotePlayer({
  player,
  seed,
  online,
  remote,
  reaction,
  onSelect,
  lod,
}: {
  player: LobbyPlayer;
  seed: number;
  online: boolean;
  remote: React.RefObject<Record<string, Remote>>;
  reaction?: Reaction;
  onSelect: (p: LobbyPlayer) => void;
  lod: Lod;
}) {
  const ref = useRef<Group>(null);
  const near = useNear(ref, player.id, lod);
  const [walking, setWalking] = useState(false);
  const start = useMemo(() => {
    const a = seed * 1.7 + 0.5;
    const r = 7 + ((seed * 37) % 100) / 100 * (WORLD_RADIUS - 10);
    return [Math.sin(a) * r, 0, Math.cos(a) * r] as [number, number, number];
  }, [seed]);

  useFrame(() => {
    const g = ref.current;
    const r = remote.current[player.id];
    if (!g || !r || !online) {
      if (walking) setWalking(false);
      return;
    }
    g.position.x += (r.x - g.position.x) * 0.2;
    g.position.z += (r.z - g.position.z) * 0.2;
    g.rotation.y = r.ry;
    const moving = r.walking || Math.hypot(r.x - g.position.x, r.z - g.position.z) > 0.05;
    if (moving !== walking) setWalking(moving);
  });

  return (
    <group ref={ref} position={start} onClick={(e) => (e.stopPropagation(), onSelect(player))}>
      {near ? (
        <>
          <BlockAvatar config={player.config} walking={walking} scale={0.75} emote={activeEmote(reaction)} />
          <NameTag player={player} reaction={reaction} online={online} />
        </>
      ) : (
        <LowAvatar config={player.config} scale={0.75} />
      )}
    </group>
  );
});

function Player({
  me,
  input,
  reaction,
  taken,
  onCollect,
  onMove,
}: {
  me: LobbyPlayer;
  input: React.RefObject<Input>;
  reaction?: Reaction;
  taken: Record<number, number>;
  onCollect: (i: number) => void;
  /** Live mode: publish my position (throttled here). */
  onMove?: (m: Remote) => void;
}) {
  const ref = useRef<Group>(null);
  const [walking, setWalking] = useState(false);
  const { camera } = useThree();
  const camTarget = useMemo(() => new Vector3(), []);
  const lastSent = useRef({ t: 0, walking: false });

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const { x, z } = input.current;
    const moving = Math.abs(x) + Math.abs(z) > 0.05;
    if (moving !== walking) setWalking(moving);
    if (moving) {
      const speed = 8 * Math.min(dt, 0.05);
      const nx = g.position.x + x * speed;
      const nz = g.position.z + z * speed;
      const inside = Math.hypot(nx, nz) < WORLD_RADIUS;
      const onPodium = Math.abs(nx) < 3.5 && Math.abs(nz + 2.5) < 1.3;
      if (inside && !onPodium) {
        g.position.x = nx;
        g.position.z = nz;
      }
      g.rotation.y = Math.atan2(x, z);
      COLLECTIBLES.forEach(([cx, cz], i) => {
        if (!taken[i] && Math.hypot(g.position.x - cx, g.position.z - cz) < 1.1) onCollect(i);
      });
    }
    if (onMove) {
      const t = performance.now();
      const s = lastSent.current;
      // ~8 updates/s while walking, one on stop, a heartbeat every 3s.
      if ((moving && t - s.t > 120) || moving !== s.walking || t - s.t > 3000) {
        onMove({ x: g.position.x, z: g.position.z, ry: g.rotation.y, walking: moving });
        lastSent.current = { t, walking: moving };
      }
    }
    camTarget.set(g.position.x, g.position.y + 8.5, g.position.z + 10.5);
    camera.position.lerp(camTarget, 0.08);
    camera.lookAt(g.position.x, g.position.y + 1.4, g.position.z - 1);
  });

  return (
    <group ref={ref} position={[0, 0, 7]}>
      <BlockAvatar config={me.config} walking={walking} scale={0.75} emote={activeEmote(reaction)} />
      <NameTag player={me} reaction={reaction} online={Boolean(onMove)} />
    </group>
  );
}

// ------------------------------------------------------------------ inputs

function useKeyboard(setInput: (v: Input) => void) {
  useEffect(() => {
    const down = new Set<string>();
    const sync = () => {
      const x = (down.has("right") ? 1 : 0) - (down.has("left") ? 1 : 0);
      const z = (down.has("down") ? 1 : 0) - (down.has("up") ? 1 : 0);
      const len = Math.hypot(x, z) || 1;
      setInput({ x: x / len, z: z / len });
    };
    const map: Record<string, string> = {
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
      ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
    };
    const onDown = (e: KeyboardEvent) => {
      const k = map[e.code];
      if (!k) return;
      if (e.target instanceof Element && e.target.closest("input, textarea, select")) return;
      e.preventDefault();
      down.add(k);
      sync();
    };
    const onUp = (e: KeyboardEvent) => {
      const k = map[e.code];
      if (!k) return;
      down.delete(k);
      sync();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [setInput]);
}

/** On-screen joystick (touch + mouse). */
function Joystick({ onInput }: { onInput: (v: Input) => void }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(false);

  function move(clientX: number, clientY: number) {
    const el = base.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let dx = clientX - (r.left + r.width / 2);
    let dy = clientY - (r.top + r.height / 2);
    const max = r.width / 2 - 14;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    setKnob({ x: dx, y: dy });
    onInput({ x: dx / max, z: dy / max });
  }
  function end() {
    active.current = false;
    setKnob({ x: 0, y: 0 });
    onInput({ x: 0, z: 0 });
  }

  return (
    <div
      ref={base}
      className="absolute bottom-4 left-4 z-20 size-28 touch-none rounded-full border-4 border-[#0a0a0a] bg-white/70 shadow-[3px_3px_0_#0a0a0a]"
      onPointerDown={(e) => {
        active.current = true;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
        move(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => active.current && move(e.clientX, e.clientY)}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="Joystick"
    >
      <div
        className="absolute left-1/2 top-1/2 size-12 rounded-full border-4 border-[#0a0a0a] bg-[#fd9fb0]"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}

function PlayerCard({
  player,
  onClose,
  onInteract,
}: {
  player: LobbyPlayer;
  onClose: () => void;
  onInteract: (kind: "clap" | "heart" | "wave") => void;
}) {
  const title = ITEM_BY_ID.get(player.config.title);
  return (
    <div className="absolute left-1/2 top-16 z-20 w-64 -translate-x-1/2 rounded-2xl border-4 border-[#0a0a0a] bg-white p-3 shadow-[4px_4px_0_#0a0a0a]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-extrabold leading-tight">{player.name}</p>
          {title && title.id !== "title-none" ? <p className="text-xs font-bold text-[#b297d3]">{title.name}</p> : null}
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg border-2 border-[#0a0a0a] px-1.5 text-xs font-bold">
          ✕
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[0.65rem] font-bold">
        <span className="rounded-lg bg-[#f0eaf6] p-1.5">⭐ {player.tier ?? "—"}</span>
        <span className="rounded-lg bg-[#def8f7] p-1.5">🏆 {player.position ? `${player.position}º no mês` : "—"}</span>
        <span className="rounded-lg bg-[#ffecef] p-1.5">{player.badges != null ? `🎖️ ${player.badges}` : "💜 Embaixadora"}</span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {(
          [
            ["clap", "👏", "Aplaudir"],
            ["heart", "💜", "Carinho"],
            ["wave", "👋", "Acenar"],
          ] as const
        ).map(([kind, emoji, label]) => (
          <button
            key={kind}
            type="button"
            onClick={() => onInteract(kind)}
            className="flex flex-col items-center rounded-xl border-[3px] border-[#0a0a0a] bg-[#fd9fb0] py-1.5 text-[0.65rem] font-extrabold shadow-[2px_2px_0_#0a0a0a] active:translate-y-0.5 active:shadow-none"
          >
            <span className="text-lg">{emoji}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
