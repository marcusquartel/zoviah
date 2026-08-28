/**
 * Schema for the model's output. The application NEVER trusts the model's text
 * directly — everything is parsed and validated here (§32). Forbidden fields
 * (overall_score, tier, confidence, approval, …) are ignored: the model does
 * not decide the score, the tier, or any decision (§30).
 */
import { z } from "zod";
import { EVIDENCE_STATUSES } from "./criteria.ts";

const shortText = z.string().trim().max(600);

const criterionSchema = z
  .object({
    score: z
      .number()
      .int()
      .min(0)
      .max(100)
      .nullable()
      .catch(null),
    coverage: z.number().min(0).max(1).catch(0),
    evidence_status: z.enum(EVIDENCE_STATUSES).catch("insufficient"),
    rationale: shortText.catch(""),
    evidence_used: z.array(z.string().trim().max(200)).max(12).catch([]),
  })
  // A null score must not claim to be well-covered.
  .transform((c) => {
    if (c.score === null) {
      return { ...c, coverage: Math.min(c.coverage, 0.4) };
    }
    return c;
  });

/** Cap a text list deterministically (§46, §48, §49, §76) — never reject. */
const cappedText = (max: number) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((arr) =>
      arr
        .map((v) => (typeof v === "string" ? v.trim().slice(0, 600) : ""))
        .filter((s) => s.length > 0)
        .slice(0, max),
    );

export const qualitativeSchema = z.object({
  summary: z
    .unknown()
    .transform((s) => (typeof s === "string" ? s.trim().slice(0, 1200) : "")),
  strengths: cappedText(5),
  attention_points: cappedText(5),
  suggested_tags: z
    .array(z.unknown())
    .catch([])
    .transform((arr) =>
      arr
        .map((v) =>
          typeof v === "string" ? v.trim().toLowerCase().slice(0, 40) : "",
        )
        .filter((s) => s.length > 0)
        .slice(0, 8),
    ),
  // Only the 3 qualitative criteria — the model never touches the other 5.
  criteria: z.object({
    content_quality: criterionSchema,
    communication: criterionSchema,
    brand_affinity: criterionSchema,
  }),
});

export type QualitativeOutput = z.infer<typeof qualitativeSchema>;

/**
 * Parse a raw model string. Strips markdown fences, ignores unknown top-level
 * keys, applies the schema (which is lenient per-field but strict on shape).
 */
export function parseQualitative(
  raw: string,
): { ok: true; data: QualitativeOutput } | { ok: false; error: string } {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  const parsed = qualitativeSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "schema_mismatch",
    };
  }
  return { ok: true, data: parsed.data };
}
