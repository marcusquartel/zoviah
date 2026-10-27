"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import type { Group, Mesh } from "three";
import { ITEM_BY_ID, type AvatarConfig } from "@/lib/game/catalog";

/**
 * Original blocky avatar (Rare Way style). Pure geometry — boxes and a few
 * cylinders — so it renders fast on phones. `walking` swings the limbs.
 */

const color = (id: string, fallback: string) => ITEM_BY_ID.get(id)?.color ?? fallback;
const color2 = (id: string, fallback: string) => ITEM_BY_ID.get(id)?.color2 ?? fallback;

function Box({
  size,
  position,
  c,
  rotation,
  opacity,
}: {
  size: [number, number, number];
  position: [number, number, number];
  c: string;
  rotation?: [number, number, number];
  opacity?: number;
}) {
  return (
    <mesh position={position} rotation={rotation} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={c}
        roughness={0.55}
        transparent={opacity != null}
        opacity={opacity ?? 1}
      />
    </mesh>
  );
}

export type Emote = "wave" | "dance" | "clap" | "heart" | null;

export function BlockAvatar({
  config,
  walking = false,
  scale = 1,
  emote = null,
}: {
  config: AvatarConfig;
  walking?: boolean;
  scale?: number;
  /** Gesture played on top of idle/walk. */
  emote?: Emote;
}) {
  const root = useRef<Group>(null);
  const armL = useRef<Group>(null);
  const armR = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const pet = useRef<Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const swing = walking ? Math.sin(t * 9) * 0.7 : Math.sin(t * 1.6) * 0.05;
    const L = armL.current;
    const R = armR.current;
    if (L && R) {
      L.rotation.set(swing, 0, 0);
      R.rotation.set(-swing, 0, 0);
      if (emote === "wave") {
        R.rotation.set(0, 0, 2.6 + Math.sin(t * 10) * 0.35);
      } else if (emote === "clap" || emote === "heart") {
        const k = emote === "clap" ? Math.abs(Math.sin(t * 12)) * 0.35 : 0.15;
        L.rotation.set(-1.4, 0, -0.55 + k);
        R.rotation.set(-1.4, 0, 0.55 - k);
      } else if (emote === "dance") {
        L.rotation.set(0, 0, -2.4 - Math.sin(t * 8) * 0.4);
        R.rotation.set(0, 0, 2.4 + Math.sin(t * 8) * 0.4);
      }
    }
    if (legL.current) legL.current.rotation.x = walking ? -swing : emote === "dance" ? Math.sin(t * 8) * 0.3 : 0;
    if (legR.current) legR.current.rotation.x = walking ? swing : emote === "dance" ? -Math.sin(t * 8) * 0.3 : 0;
    if (root.current) {
      root.current.position.y =
        emote === "dance"
          ? Math.abs(Math.sin(t * 8)) * 0.25
          : walking
            ? Math.abs(Math.sin(t * 9)) * 0.08
            : Math.sin(t * 1.6) * 0.03;
      root.current.rotation.y = emote === "dance" ? Math.sin(t * 4) * 0.6 : 0;
    }
    if (pet.current) pet.current.position.y = 0.05 + Math.abs(Math.sin(t * (emote === "dance" ? 8 : 3))) * 0.12;
  });

  const skin = color(config.skin, "#c98e66");
  const hair = color(config.hairColor, "#5a3420");
  const top = color(config.top, "#f7f5fb");
  const topAccent = color2(config.top, top);
  const bottom = color(config.bottom, "#1b1b1f");

  return (
    <group scale={scale}>
      <group ref={root}>
        {/* legs (pivot at the hip) */}
        <group ref={legL} position={[-0.26, 1.2, 0]}>
          <Box size={[0.46, 1.0, 0.5]} position={[0, -0.5, 0]} c={bottom} />
          <Box size={[0.48, 0.2, 0.56]} position={[0, -1.1, 0.03]} c="#141414" />
        </group>
        <group ref={legR} position={[0.26, 1.2, 0]}>
          <Box size={[0.46, 1.0, 0.5]} position={[0, -0.5, 0]} c={bottom} />
          <Box size={[0.48, 0.2, 0.56]} position={[0, -1.1, 0.03]} c="#141414" />
        </group>

        {/* torso */}
        <Box size={[1.0, 1.05, 0.55]} position={[0, 1.72, 0]} c={top} />
        <TopDetails id={config.top} accent={topAccent} />

        {/* arms (pivot at the shoulder) */}
        <group ref={armL} position={[-0.74, 2.15, 0]}>
          <Box size={[0.4, 0.55, 0.45]} position={[0, -0.25, 0]} c={top} />
          <Box size={[0.38, 0.5, 0.43]} position={[0, -0.75, 0]} c={skin} />
        </group>
        <group ref={armR} position={[0.74, 2.15, 0]}>
          <Box size={[0.4, 0.55, 0.45]} position={[0, -0.25, 0]} c={top} />
          <Box size={[0.38, 0.5, 0.43]} position={[0, -0.75, 0]} c={skin} />
        </group>

        {/* head */}
        <group position={[0, 2.78, 0]}>
          <Box size={[0.95, 0.95, 0.9]} position={[0, 0, 0]} c={skin} />
          {/* face */}
          <Box size={[0.13, 0.17, 0.02]} position={[-0.2, 0.06, 0.46]} c="#1a1a1a" />
          <Box size={[0.13, 0.17, 0.02]} position={[0.2, 0.06, 0.46]} c="#1a1a1a" />
          <Box size={[0.05, 0.05, 0.02]} position={[-0.17, 0.11, 0.47]} c="#ffffff" />
          <Box size={[0.05, 0.05, 0.02]} position={[0.23, 0.11, 0.47]} c="#ffffff" />
          <Box size={[0.3, 0.06, 0.02]} position={[0, -0.2, 0.46]} c="#b5485e" />
          <Box size={[0.14, 0.07, 0.02]} position={[-0.32, -0.1, 0.46]} c="#fd9fb0" opacity={0.7} />
          <Box size={[0.14, 0.07, 0.02]} position={[0.32, -0.1, 0.46]} c="#fd9fb0" opacity={0.7} />
          <Hair style={config.hair} c={hair} />
          <HeadAccessory id={config.head} />
        </group>

        <Back id={config.back} />
      </group>

      {config.pet !== "pet-none" ? (
        <group ref={pet} position={[1.1, 0.05, 0.6]}>
          <Pet id={config.pet} />
        </group>
      ) : null}

      <Effect id={config.effect} />
    </group>
  );
}

function TopDetails({ id, accent }: { id: string; accent: string }) {
  if (id === "top-rareway") {
    // "RW" emblem block
    return <Box size={[0.42, 0.22, 0.02]} position={[0, 1.85, 0.285]} c={accent} />;
  }
  if (id === "top-coat") {
    return (
      <>
        <Box size={[0.06, 1.0, 0.02]} position={[0, 1.72, 0.285]} c="#d5d5d5" />
        <Box size={[0.22, 0.2, 0.02]} position={[-0.26, 1.55, 0.285]} c={accent} />
        <Box size={[1.02, 0.12, 0.57]} position={[0, 2.2, 0]} c={accent} />
      </>
    );
  }
  if (id === "top-poderosa") {
    return (
      <>
        <Box size={[0.14, 0.7, 0.02]} position={[-0.14, 1.85, 0.285]} c={accent} rotation={[0, 0, 0.35]} />
        <Box size={[0.14, 0.7, 0.02]} position={[0.14, 1.85, 0.285]} c={accent} rotation={[0, 0, -0.35]} />
      </>
    );
  }
  return null;
}

function Hair({ style, c }: { style: string; c: string }) {
  const cap = <Box size={[1.02, 0.28, 0.98]} position={[0, 0.42, -0.02]} c={c} />;
  const backSlab = (h: number) => <Box size={[1.02, h, 0.18]} position={[0, 0.48 - h / 2, -0.47]} c={c} />;
  const sides = (h: number) => (
    <>
      <Box size={[0.14, h, 0.95]} position={[-0.53, 0.48 - h / 2, -0.03]} c={c} />
      <Box size={[0.14, h, 0.95]} position={[0.53, 0.48 - h / 2, -0.03]} c={c} />
    </>
  );
  const fringe = <Box size={[1.0, 0.18, 0.12]} position={[0, 0.34, 0.44]} c={c} />;

  switch (style) {
    case "hair-short":
      return (
        <>
          {cap}
          {backSlab(0.6)}
          {fringe}
        </>
      );
    case "hair-bob":
      return (
        <>
          {cap}
          {backSlab(0.95)}
          {sides(0.85)}
          {fringe}
        </>
      );
    case "hair-curly":
      return (
        <>
          <Box size={[1.45, 1.05, 1.3]} position={[0, 0.35, -0.15]} c={c} />
          <Box size={[0.4, 0.4, 0.4]} position={[-0.7, -0.15, -0.2]} c={c} />
          <Box size={[0.4, 0.4, 0.4]} position={[0.7, -0.15, -0.2]} c={c} />
        </>
      );
    case "hair-ponytail":
      return (
        <>
          {cap}
          {backSlab(0.5)}
          {fringe}
          <Box size={[0.3, 0.9, 0.3]} position={[0, -0.05, -0.65]} c={c} rotation={[0.35, 0, 0]} />
        </>
      );
    case "hair-bun":
      return (
        <>
          {cap}
          {backSlab(0.55)}
          {fringe}
          <Box size={[0.48, 0.42, 0.48]} position={[0, 0.75, -0.1]} c={c} />
        </>
      );
    case "hair-long":
    default:
      return (
        <>
          {cap}
          {sides(1.15)}
          <Box size={[1.02, 1.55, 0.2]} position={[0, -0.3, -0.47]} c={c} />
          {fringe}
        </>
      );
  }
}

function HeadAccessory({ id }: { id: string }) {
  if (id === "head-band") {
    return (
      <>
        <Box size={[1.06, 0.2, 1.0]} position={[0, 0.3, 0]} c={color(id, "#d9d9de")} />
        <Box size={[0.4, 0.08, 0.02]} position={[0, 0.3, 0.505]} c={color2(id, "#0a0a0a")} />
      </>
    );
  }
  if (id === "head-glasses") {
    const c = color(id, "#9be9e6");
    return (
      <>
        <Box size={[0.3, 0.22, 0.04]} position={[-0.2, 0.06, 0.48]} c={c} opacity={0.75} />
        <Box size={[0.3, 0.22, 0.04]} position={[0.2, 0.06, 0.48]} c={c} opacity={0.75} />
        <Box size={[0.12, 0.04, 0.04]} position={[0, 0.1, 0.48]} c="#e6fbfa" />
      </>
    );
  }
  if (id === "head-crown") {
    const c = color(id, "#f5c542");
    return (
      <group position={[0, 0.66, 0]}>
        <Box size={[0.8, 0.16, 0.8]} position={[0, 0, 0]} c={c} />
        {[-0.3, 0, 0.3].map((x) => (
          <Box key={`f${x}`} size={[0.14, 0.24, 0.14]} position={[x, 0.18, 0.33]} c={c} />
        ))}
        {[-0.3, 0, 0.3].map((x) => (
          <Box key={`b${x}`} size={[0.14, 0.24, 0.14]} position={[x, 0.18, -0.33]} c={c} />
        ))}
        <Box size={[0.1, 0.1, 0.02]} position={[0, 0.02, 0.41]} c="#fd9fb0" />
      </group>
    );
  }
  return null;
}

function Back({ id }: { id: string }) {
  if (id === "back-wings") {
    const c = color(id, "#e0d5ed");
    return (
      <>
        <Box size={[0.9, 1.2, 0.08]} position={[-0.6, 2.0, -0.45]} c={c} rotation={[0, 0.5, 0.25]} opacity={0.85} />
        <Box size={[0.9, 1.2, 0.08]} position={[0.6, 2.0, -0.45]} c={c} rotation={[0, -0.5, -0.25]} opacity={0.85} />
      </>
    );
  }
  if (id === "back-backpack") {
    return (
      <group position={[0, 1.8, -0.5]}>
        <Box size={[0.8, 0.9, 0.38]} position={[0, 0, 0]} c={color(id, "#7a3f17")} />
        <Box size={[0.5, 0.3, 0.02]} position={[0, 0.05, -0.2]} c={color2(id, "#f7f5fb")} />
        <Box size={[0.22, 0.14, 0.2]} position={[0, 0.52, 0]} c="#0a0a0a" />
      </group>
    );
  }
  if (id === "back-cape") {
    return (
      <>
        <Box size={[1.1, 2.0, 0.06]} position={[0, 1.25, -0.34]} c={color(id, "#0a0a0a")} rotation={[0.08, 0, 0]} />
        <Box size={[1.0, 1.9, 0.02]} position={[0, 1.25, -0.3]} c={color2(id, "#fd9fb0")} rotation={[0.08, 0, 0]} />
      </>
    );
  }
  return null;
}

function Pet({ id }: { id: string }) {
  if (id === "pet-cat") {
    const c = color(id, "#f2a65a");
    return (
      <group scale={0.55}>
        <Box size={[0.8, 0.55, 1.0]} position={[0, 0.45, 0]} c={c} />
        <Box size={[0.65, 0.6, 0.6]} position={[0, 0.95, 0.45]} c={c} />
        <Box size={[0.18, 0.22, 0.1]} position={[-0.2, 1.35, 0.45]} c={c} />
        <Box size={[0.18, 0.22, 0.1]} position={[0.2, 1.35, 0.45]} c={c} />
        <Box size={[0.08, 0.1, 0.02]} position={[-0.14, 1.0, 0.76]} c="#1a1a1a" />
        <Box size={[0.08, 0.1, 0.02]} position={[0.14, 1.0, 0.76]} c="#1a1a1a" />
        <Box size={[0.12, 0.6, 0.12]} position={[0, 0.8, -0.55]} c={c} rotation={[0.6, 0, 0]} />
        {/* tiny brush */}
        <Box size={[0.06, 0.5, 0.06]} position={[0.42, 0.75, 0.55]} c="#0a0a0a" rotation={[0, 0, -0.5]} />
      </group>
    );
  }
  if (id === "pet-bunny") {
    const c = color(id, "#ffffff");
    return (
      <group scale={0.55}>
        <Box size={[0.75, 0.6, 0.8]} position={[0, 0.4, 0]} c={c} />
        <Box size={[0.6, 0.55, 0.55]} position={[0, 0.9, 0.3]} c={c} />
        <Box size={[0.14, 0.6, 0.1]} position={[-0.16, 1.45, 0.25]} c={c} />
        <Box size={[0.14, 0.6, 0.1]} position={[0.16, 1.45, 0.25]} c={c} />
        <Box size={[0.08, 0.4, 0.02]} position={[-0.16, 1.45, 0.31]} c={color2(id, "#fd9fb0")} />
        <Box size={[0.08, 0.4, 0.02]} position={[0.16, 1.45, 0.31]} c={color2(id, "#fd9fb0")} />
        <Box size={[0.08, 0.1, 0.02]} position={[-0.13, 0.95, 0.58]} c="#1a1a1a" />
        <Box size={[0.08, 0.1, 0.02]} position={[0.13, 0.95, 0.58]} c="#1a1a1a" />
        {/* Glance bottle */}
        <mesh position={[0.45, 0.55, 0.35]}>
          <cylinderGeometry args={[0.12, 0.12, 0.35, 12]} />
          <meshStandardMaterial color="#6b3b1f" />
        </mesh>
        <mesh position={[0.45, 0.78, 0.35]}>
          <cylinderGeometry args={[0.1, 0.1, 0.12, 12]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
      </group>
    );
  }
  return null;
}

function Effect({ id }: { id: string }) {
  const ring = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.z = clock.getElapsedTime() * 0.8;
  });
  if (id === "fx-sparkle") {
    return <Sparkles count={40} scale={[2.2, 3.4, 2.2]} position={[0, 1.7, 0]} size={4} speed={0.6} color="#ffffff" />;
  }
  if (id === "fx-aura-turq" || id === "fx-aura-rara") {
    const c = color(id, "#59dbd6");
    return (
      <>
        <mesh ref={ring} position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.25, 6]} />
          <meshBasicMaterial color={c} transparent opacity={0.7} />
        </mesh>
        <mesh position={[0, 1.7, 0]}>
          <cylinderGeometry args={[1.1, 1.1, 3.6, 24, 1, true]} />
          <meshBasicMaterial color={c} transparent opacity={0.12} />
        </mesh>
        <Sparkles count={30} scale={[2.4, 3.6, 2.4]} position={[0, 1.7, 0]} size={5} speed={0.4} color={c} />
      </>
    );
  }
  return null;
}
