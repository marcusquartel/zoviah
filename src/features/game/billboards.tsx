"use client";

import { Suspense, useState } from "react";
import { useTexture } from "@react-three/drei";
import { SRGBColorSpace, type Texture } from "three";
import { WORLD_SCALE } from "@/features/game/world";

/**
 * Rare Way ads around Glance World: banners from the brand's site, on
 * billboards at the edge of the map, facing the center.
 * Images live in org-branding/rare-way/game/billboards.
 */
const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/org-branding/rare-way/game/billboards`;

const SITE = "https://www.rarewaycosmeticos.com.br";

type Ad = {
  file: string;
  href: string;
  angle: number;
  w: number;
  h: number;
  trim: string;
};

// angle: around the map, 0 = toward the camera (+z), degrees.
const ADS: Ad[] = [
  {
    file: "glance-color.jpg",
    href: "/collections/glance-color",
    angle: 140,
    w: 10,
    h: 3.57,
    trim: "#c1acdc",
  },
  {
    file: "brow-lamination.jpg",
    href: "/collections/brow-lamination",
    angle: 220,
    w: 10,
    h: 3.57,
    trim: "#fd9fb0",
  },
  {
    file: "brindes.jpg",
    href: "/",
    angle: 268,
    w: 10,
    h: 3.57,
    trim: "#fd9fb0",
  },
  {
    file: "combo-02.jpg",
    href: "/products/brow-lamination-lift",
    angle: 92,
    w: 4.6,
    h: 4.6,
    trim: "#c1acdc",
  },
  {
    file: "combo-04.jpg",
    href: "/products/henna-8-cores-henna-chocolate",
    angle: 58,
    w: 4.2,
    h: 4.2,
    trim: "#59dbd6",
  },
  {
    file: "combo-03.jpg",
    href: "/products/henna-8-cores-demaquilante-glance-care",
    angle: 302,
    w: 4.2,
    h: 4.2,
    trim: "#59dbd6",
  },
];

const RADIUS = 20.6 * WORLD_SCALE;

/** Opens the ad's page on the brand site, tagged so the visit shows up in analytics. */
function openAd(ad: Ad) {
  const url = new URL(ad.href, SITE);
  url.searchParams.set("utm_source", "glance-world");
  url.searchParams.set("utm_medium", "portal");
  url.searchParams.set("utm_campaign", ad.file.replace(/\.\w+$/, ""));
  window.open(url.toString(), "_blank", "noopener");
}

function prepare(tex: Texture | Texture[]) {
  for (const t of Array.isArray(tex) ? tex : [tex]) {
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
  }
}

export function Billboards() {
  return (
    <Suspense fallback={null}>
      {ADS.map((ad) => (
        <Billboard key={ad.file} ad={ad} />
      ))}
    </Suspense>
  );
}

function Billboard({ ad }: { ad: Ad }) {
  const texture = useTexture(`${BASE}/${ad.file}`, prepare);
  const [hover, setHover] = useState(false);

  const t = (ad.angle * Math.PI) / 180;
  const lift = 2.4; // bottom edge of the panel above the ground
  const cy = lift + ad.h / 2;
  const legX = ad.w / 2 - 0.6;

  return (
    <group
      position={[RADIUS * Math.sin(t), 0, RADIUS * Math.cos(t)]}
      rotation={[0, t + Math.PI, 0]}
    >
      {/* legs */}
      {[-legX, legX].map((x) => (
        <mesh key={x} position={[x, cy / 2, -0.25]} castShadow>
          <boxGeometry args={[0.35, cy, 0.35]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
      ))}
      {/* panel, tilted back a little toward the (elevated) camera */}
      <group
        position={[0, cy, 0]}
        rotation={[-0.12, 0, 0]}
        scale={hover ? 1.04 : 1}
        onClick={(e) => {
          e.stopPropagation();
          openAd(ad);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
      >
        <mesh position={[0, 0, -0.12]} castShadow>
          <boxGeometry args={[ad.w + 0.5, ad.h + 0.5, 0.2]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
        <mesh position={[0, 0, -0.01]}>
          <boxGeometry args={[ad.w + 0.24, ad.h + 0.24, 0.02]} />
          <meshStandardMaterial
            color={hover ? "#ffffff" : ad.trim}
            emissive={hover ? ad.trim : "#000000"}
          />
        </mesh>
        {/* the ad itself — unlit so the banner keeps its real colors */}
        <mesh position={[0, 0, 0.01]}>
          <planeGeometry args={[ad.w, ad.h]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
        {/* spotlights on top */}
        {[-ad.w / 3, ad.w / 3].map((x) => (
          <mesh
            key={x}
            position={[x, ad.h / 2 + 0.45, 0.35]}
            rotation={[0.6, 0, 0]}
          >
            <cylinderGeometry args={[0.12, 0.22, 0.4, 10]} />
            <meshStandardMaterial
              color="#d9d9de"
              emissive="#fff6d6"
              emissiveIntensity={0.6}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
