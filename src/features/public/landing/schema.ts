import { z } from "zod";

/**
 * Landing content stored in programs.landing. Every string is plain text
 * (rendered as React text, never HTML). Images are https URLs.
 */
const text = (max: number) => z.string().trim().max(max);
const image = z.url({ protocol: /^https$/ }).max(500);

const textSection = z.object({
  type: z.literal("text"),
  eyebrow: text(60).optional(),
  title: text(120),
  body: text(2000),
  quote: text(400).optional(),
  image: image.optional(),
  imageSide: z.enum(["left", "right"]).optional(),
  dark: z.boolean().optional(),
});

const listSection = z.object({
  type: z.literal("list"),
  eyebrow: text(60).optional(),
  title: text(120),
  intro: text(600).optional(),
  items: z.array(text(240)).min(1).max(20),
  dark: z.boolean().optional(),
});

const tiersSection = z.object({
  type: z.literal("tiers"),
  eyebrow: text(60).optional(),
  title: text(120),
  intro: text(600).optional(),
  tiers: z
    .array(
      z.object({
        name: text(40),
        tagline: text(160).optional(),
        image: image.optional(),
        benefits: z.array(text(200)).min(1).max(20),
      }),
    )
    .min(1)
    .max(5),
  dark: z.boolean().optional(),
});

const stepsSection = z.object({
  type: z.literal("steps"),
  eyebrow: text(60).optional(),
  title: text(120),
  steps: z.array(z.object({ title: text(80), body: text(300) })).min(1).max(8),
  dark: z.boolean().optional(),
});

/** Illustrative mock-ups of the creator portal (fictional data). */
const portalSection = z.object({
  type: z.literal("portal"),
  eyebrow: text(60).optional(),
  title: text(120),
  body: text(600).optional(),
  bullets: z.array(text(160)).max(8).default([]),
  /** Fictional creator shown in the mock-ups. */
  sample: z
    .object({ name: text(40), coupon: text(30), tier: text(30), photo: image.optional() })
    .default({ name: "Ana", coupon: "ANASOUZA", tier: "Rara" }),
});

const closingSection = z.object({
  type: z.literal("closing"),
  title: text(160),
  body: text(600).optional(),
  image: image.optional(),
});

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const landingSchema = z.object({
  /** Brand palette: background, ink and three accents (+ their light tints). */
  theme: z
    .object({
      background: hex,
      ink: hex,
      accent1: hex,
      accent2: hex,
      accent3: hex,
      accent1Light: hex,
      accent2Light: hex,
      accent3Light: hex,
      accent2Deep: hex,
    })
    .default({
      background: "#ffffff",
      ink: "#0a0a0a",
      accent1: "#d4d4d4",
      accent2: "#a3a3a3",
      accent3: "#737373",
      accent1Light: "#f5f5f5",
      accent2Light: "#f5f5f5",
      accent3Light: "#f5f5f5",
      accent2Deep: "#262626",
    }),
  /** Small brand signatures: "● SUA BELEZA TEM PODER", "@RAREWAY /// RAREWAY.COM.BR". */
  brand: z
    .object({ tagline: text(60).optional(), signature: text(80).optional() })
    .default({}),
  hero: z.object({
    eyebrow: text(60).optional(),
    title: text(80),
    subtitle: text(200).optional(),
    body: text(600).optional(),
    cta: text(40).default("Quero participar"),
    image: image.optional(),
  }),
  sections: z
    .array(
      z.discriminatedUnion("type", [textSection, listSection, tiersSection, stepsSection, portalSection, closingSection]),
    )
    .max(12)
    .default([]),
  form: z
    .object({ eyebrow: text(60).optional(), title: text(120), intro: text(600).optional() })
    .default({ title: "Inscreva-se" }),
});

export type Landing = z.infer<typeof landingSchema>;
export type LandingSection = Landing["sections"][number];

/** Parse stored JSON; invalid content falls back to the plain form page. */
export function parseLanding(raw: unknown): Landing | null {
  if (!raw) return null;
  const parsed = landingSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
