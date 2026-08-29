import { z } from "zod";

/** ISO datetime, not more than 1 day in the future (§22). */
const observedAt = z
  .string()
  .trim()
  .min(1, { error: "Informe a data da observação." })
  .refine((v) => !Number.isNaN(Date.parse(v)), { error: "Data inválida." })
  .refine((v) => Date.parse(v) <= Date.now() + 86_400_000, {
    error: "A data não pode ser no futuro.",
  });

const nonNegInt = z
  .union([z.literal(""), z.coerce.number().int().min(0)])
  .transform((v) => (v === "" ? null : v));

const nonNegNum = z
  .union([z.literal(""), z.coerce.number().min(0)])
  .transform((v) => (v === "" ? null : v));

export const metricSnapshotSchema = z
  .object({
    socialProfileId: z.uuid(),
    source: z.enum([
      "declared",
      "admin_manual",
      "creator_provided",
      "import",
      "api",
    ]),
    observedAt,
    periodDays: z
      .union([z.literal(""), z.coerce.number().int().min(1).max(365)])
      .transform((v) => (v === "" ? null : v)),
    followers: nonNegInt,
    /** Up to 30 non-negative integers (§13, §14). */
    viewsSample: z
      .array(z.number().int().min(0))
      .max(30, { error: "No máximo 30 conteúdos na amostra." })
      .default([]),
    averageViews: nonNegInt,
    medianViews: nonNegInt,
    averageLikes: nonNegNum,
    averageComments: nonNegNum,
    averageShares: nonNegNum,
    averageSaves: nonNegNum,
    reach: nonNegInt,
    interactions: nonNegInt,
    postsCount: nonNegInt,
    notes: z.string().trim().max(500).optional().default(""),
  })
  // At least one metric must be present — no empty snapshots (§39).
  .refine(
    (v) =>
      v.followers != null ||
      v.viewsSample.length > 0 ||
      v.averageViews != null ||
      v.medianViews != null ||
      v.averageLikes != null ||
      v.averageComments != null ||
      v.averageShares != null ||
      v.averageSaves != null ||
      v.reach != null ||
      v.interactions != null ||
      v.postsCount != null,
    { error: "Informe ao menos uma métrica." },
  );

export type MetricSnapshotInput = z.infer<typeof metricSnapshotSchema>;
