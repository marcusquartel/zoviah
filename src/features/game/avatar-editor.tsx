"use client";

import { useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Lock } from "lucide-react";
import { BlockAvatar } from "@/features/game/block-avatar";
import {
  ACHIEVEMENTS,
  ITEMS,
  RARITY_COLOR,
  RARITY_LABEL,
  type AvatarConfig,
  type Item,
  type Slot,
} from "@/lib/game/catalog";
import { cn } from "@/lib/utils";

const TABS: { slot: Slot; label: string; emoji: string }[] = [
  { slot: "skin", label: "Pele", emoji: "🎨" },
  { slot: "hair", label: "Cabelo", emoji: "💇‍♀️" },
  { slot: "hairColor", label: "Cor do cabelo", emoji: "🌈" },
  { slot: "top", label: "Roupa", emoji: "👚" },
  { slot: "bottom", label: "Calça", emoji: "👖" },
  { slot: "head", label: "Cabeça", emoji: "👑" },
  { slot: "back", label: "Costas", emoji: "🪽" },
  { slot: "pet", label: "Pet", emoji: "🐰" },
  { slot: "effect", label: "Efeito", emoji: "✨" },
  { slot: "title", label: "Título", emoji: "🏷️" },
];

const ACH_BY_ID = new Map(ACHIEVEMENTS.map((a) => [a.id, a]));

export function AvatarStage({ config, height = 420 }: { config: AvatarConfig; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <Canvas shadows camera={{ position: [0, 2.4, 7.2], fov: 38 }} dpr={[1, 2]}>
        <color attach="background" args={["#f0eaf6"]} />
        <ambientLight intensity={0.85} />
        <directionalLight position={[4, 8, 5]} intensity={1.4} castShadow />
        <group position={[0, -1.7, 0]}>
          <BlockAvatar config={config} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
            <circleGeometry args={[2.2, 48]} />
            <meshStandardMaterial color="#c1acdc" />
          </mesh>
          <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={6} blur={2.5} />
        </group>
        <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={1.2} minPolarAngle={1.1} maxPolarAngle={1.6} />
      </Canvas>
    </div>
  );
}

export function AvatarEditor({
  initial,
  unlocked,
  onSave,
}: {
  initial: AvatarConfig;
  unlocked: Set<string>;
  onSave?: (config: AvatarConfig) => void;
}) {
  const [config, setConfig] = useState(initial);
  const [slot, setSlot] = useState<Slot>("hair");
  const items = useMemo(() => ITEMS.filter((i) => i.slot === slot), [slot]);
  const title = ITEMS.find((i) => i.id === config.title);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <div className="min-w-0 overflow-hidden rounded-3xl border-4 border-[#0a0a0a] bg-[#f0eaf6] shadow-[6px_6px_0_#0a0a0a]">
        <div className="flex items-center justify-between border-b-4 border-[#0a0a0a] bg-[#59dbd6] px-4 py-2">
          <span className="text-sm font-bold uppercase tracking-wide">Meu avatar</span>
          {title && title.id !== "title-none" ? (
            <span className="rounded-full bg-[#0a0a0a] px-3 py-0.5 text-xs font-bold text-[#f5c542]">{title.name}</span>
          ) : null}
        </div>
        <AvatarStage config={config} />
      </div>

      <div className="min-w-0 rounded-3xl border-4 border-[#0a0a0a] bg-white p-3 shadow-[6px_6px_0_#0a0a0a]">
        <div className="flex gap-1.5 overflow-x-auto pb-2">
          {TABS.map((t) => (
            <button
              key={t.slot}
              type="button"
              onClick={() => setSlot(t.slot)}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-xl border-2 border-[#0a0a0a] px-3 py-1.5 text-xs font-bold transition-transform active:translate-y-0.5",
                slot === t.slot ? "bg-[#fd9fb0] shadow-[2px_2px_0_#0a0a0a]" : "bg-white",
              )}
            >
              <span aria-hidden>{t.emoji}</span> {t.label}
            </button>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((item) => (
            <ItemTile
              key={item.id}
              item={item}
              equipped={config[slot] === item.id}
              locked={!unlocked.has(item.id)}
              onPick={() => setConfig({ ...config, [slot]: item.id })}
            />
          ))}
        </div>

        {onSave ? (
          <button
            type="button"
            onClick={() => onSave(config)}
            className="mt-4 w-full rounded-2xl border-4 border-[#0a0a0a] bg-[#59dbd6] py-3 text-base font-extrabold uppercase tracking-wide shadow-[4px_4px_0_#0a0a0a] active:translate-y-1 active:shadow-none"
          >
            Salvar visual
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ItemTile({
  item,
  equipped,
  locked,
  onPick,
}: {
  item: Item;
  equipped: boolean;
  locked: boolean;
  onPick: () => void;
}) {
  const ach = item.unlockedBy ? ACH_BY_ID.get(item.unlockedBy) : undefined;
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onPick}
      title={locked && ach ? `Desbloqueie com: ${ach.emoji} ${ach.title}` : item.name}
      className={cn(
        "relative flex flex-col items-center gap-1 rounded-2xl border-[3px] p-2 text-center transition-transform",
        equipped ? "border-[#0a0a0a] bg-[#fff7d6] shadow-[3px_3px_0_#0a0a0a]" : "border-neutral-200 bg-neutral-50",
        locked ? "cursor-not-allowed opacity-70" : "hover:-translate-y-0.5",
      )}
      style={{ outline: `3px solid ${RARITY_COLOR[item.rarity]}`, outlineOffset: "-6px" }}
    >
      <span
        className="flex size-11 items-center justify-center rounded-xl border-2 border-[#0a0a0a] text-lg"
        style={{ background: item.color ?? "#ffffff" }}
      >
        {locked ? <Lock className="size-4" /> : SLOT_GLYPH[item.slot]}
      </span>
      <span className="text-[0.68rem] font-bold leading-tight">{item.name}</span>
      <span className="text-[0.58rem] font-semibold uppercase" style={{ color: RARITY_COLOR[item.rarity] }}>
        {RARITY_LABEL[item.rarity]}
      </span>
      {locked && ach ? (
        <span className="text-[0.58rem] leading-tight text-neutral-500">
          {ach.emoji} {ach.title}
        </span>
      ) : null}
      {equipped ? (
        <span className="absolute -right-1.5 -top-1.5 rounded-full border-2 border-[#0a0a0a] bg-[#59dbd6] px-1.5 text-[0.55rem] font-extrabold">
          ✓
        </span>
      ) : null}
    </button>
  );
}

const SLOT_GLYPH: Record<Slot, string> = {
  skin: "",
  hair: "💇‍♀️",
  hairColor: "",
  top: "👚",
  bottom: "👖",
  head: "👑",
  back: "🪽",
  pet: "🐾",
  effect: "✨",
  title: "🏷️",
};
