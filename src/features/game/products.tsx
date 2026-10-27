"use client";

/**
 * Stylized 3D versions of the Glance line (Rare Way) for Glance World —
 * simple geometry, brand colors, no textures.
 */

type V3 = [number, number, number];

function Label({ position, size, color, rotation }: { position: V3; size: V3; color: string; rotation?: V3 }) {
  return (
    <mesh position={position} rotation={rotation}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

/** Glance Henna: amber glass bottle, black cap, white label. */
export function HennaBottle({ position = [0, 0, 0], scale = 1, rotation = 0 }: { position?: V3; scale?: number; rotation?: number }) {
  return (
    <group position={position} scale={scale} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.32, 0.32, 1, 20]} />
        <meshStandardMaterial color="#7a3f17" roughness={0.25} metalness={0.1} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[0.325, 0.325, 0.5, 20, 1, true]} />
        <meshStandardMaterial color="#f7f5fb" />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.12, 16]} />
        <meshStandardMaterial color="#7a3f17" />
      </mesh>
      <mesh position={[0, 1.25, 0]} castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.32, 16]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
    </group>
  );
}

/** Glance Henna kit box: white box with the rainbow stripe of the 8 shades. */
export function HennaBox({ position = [0, 0, 0], rotation = 0, scale = 1 }: { position?: V3; rotation?: number; scale?: number }) {
  const shades = ["#2b1a12", "#4a2b1a", "#6b3b1f", "#8a5a2b", "#a8763f", "#c39a5f", "#3d3d3d", "#6e4a36"];
  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.7, 1.2]} />
        <meshStandardMaterial color="#fbfbfd" />
      </mesh>
      {shades.map((c, i) => (
        <Label key={c} position={[-0.42 + i * 0.12, 0.2, 0.601]} size={[0.1, 0.08, 0.01]} color={c} />
      ))}
      <Label position={[0, 0.48, 0.601]} size={[0.8, 0.16, 0.01]} color="#0a0a0a" />
    </group>
  );
}

/** Glance Care bottle (white bottle, black cap, colored label). */
export function CareBottle({
  position = [0, 0, 0],
  color = "#c1acdc",
  scale = 1,
  rotation = 0,
}: {
  position?: V3;
  color?: string;
  scale?: number;
  rotation?: number;
}) {
  return (
    <group position={position} scale={scale} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.75, 0]} castShadow>
        <cylinderGeometry args={[0.42, 0.45, 1.5, 24]} />
        <meshStandardMaterial color="#fbfbfd" roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <cylinderGeometry args={[0.455, 0.455, 0.8, 24, 1, true]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[0, 1.62, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.32, 0.26, 20]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
    </group>
  );
}

/** Glance Brow Lamination tube. */
export function LaminationTube({ position = [0, 0, 0], rotation = 0, scale = 1 }: { position?: V3; rotation?: number; scale?: number }) {
  return (
    <group position={position} rotation={[0, rotation, Math.PI / 2]} scale={scale}>
      <mesh position={[0, 0, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 1.6, 20]} />
        <meshStandardMaterial color="#fbfbfd" />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.285, 0.285, 0.5, 20, 1, true]} />
        <meshStandardMaterial color="#e5304f" />
      </mesh>
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.22, 0.25, 16]} />
        <meshStandardMaterial color="#d9d9de" />
      </mesh>
    </group>
  );
}

/** Giant brow brush (spoolie) — a landmark. */
export function BrowBrush({ position = [0, 0, 0], rotation = 0, scale = 1 }: { position?: V3; rotation?: number; scale?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0.25]} scale={scale}>
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.12, 0.12, 3.2, 12]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      {Array.from({ length: 9 }).map((_, i) => (
        <mesh key={i} position={[0, 3.3 + i * 0.12, 0]} rotation={[0, i * 0.7, 0]}>
          <boxGeometry args={[0.7 - i * 0.04, 0.05, 0.06]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      ))}
    </group>
  );
}

/** A display "shelf" island with Glance products. */
export function ProductIsland({ position, rotation = 0 }: { position: V3; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.8, 1.9, 0.5, 6]} />
        <meshStandardMaterial color="#0a0a0a" />
      </mesh>
      <HennaBox position={[-0.7, 0.5, 0.3]} rotation={0.4} scale={0.7} />
      <HennaBox position={[-0.6, 1.0, 0.3]} rotation={0.1} scale={0.6} />
      <CareBottle position={[0.5, 0.5, -0.4]} color="#c1acdc" scale={0.7} />
      <CareBottle position={[0.95, 0.5, 0.45]} color="#59dbd6" scale={0.6} />
      <HennaBottle position={[0.1, 0.5, 0.8]} scale={0.7} />
      <LaminationTube position={[-0.2, 0.75, -0.9]} rotation={0.6} scale={0.6} />
    </group>
  );
}
