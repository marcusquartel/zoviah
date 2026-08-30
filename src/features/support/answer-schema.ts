/**
 * The support assistant's output is never trusted as text. It is parsed and
 * validated here into `{ answer, articleIds, sufficient }`. A malformed or
 * empty answer collapses to the deterministic "insufficient" response so the
 * UI always has something safe to show and always offers human support.
 */
import { z } from "zod";
import { SUPPORT_INSUFFICIENT_ANSWER } from "./prompt.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const answerSchema = z.object({
  answer: z
    .unknown()
    .transform((s) => (typeof s === "string" ? s.trim().slice(0, 4000) : "")),
  article_ids: z
    .array(z.unknown())
    .catch([])
    .transform((arr) =>
      arr
        .map((v) => (typeof v === "string" ? v.trim().toLowerCase() : ""))
        .filter((s) => UUID_RE.test(s))
        .slice(0, 8),
    ),
  sufficient: z.unknown().transform((v) => v === true),
});

export interface SupportAnswer {
  answer: string;
  articleIds: string[];
  /** True only when the model claims the docs supported the answer. */
  sufficient: boolean;
}

/**
 * Parse a raw model string into a SupportAnswer. `allowedIds` filters the
 * cited articles down to the ones actually retrieved (the model must not cite
 * an id it was not given — §54 prompt-injection hardening).
 */
export function parseSupportAnswer(
  raw: string,
  allowedIds: string[],
): { ok: true; data: SupportAnswer } | { ok: false; error: string } {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  const parsed = answerSchema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "schema_mismatch" };
  }

  const allowed = new Set(allowedIds.map((id) => id.toLowerCase()));
  const articleIds = parsed.data.article_ids.filter((id) => allowed.has(id));

  // An empty answer, or a "sufficient" claim with no citation, is not a safe
  // answer — fall back to the deterministic insufficient response.
  const answerText = parsed.data.answer;
  if (answerText.length === 0) {
    return {
      ok: true,
      data: {
        answer: SUPPORT_INSUFFICIENT_ANSWER,
        articleIds: [],
        sufficient: false,
      },
    };
  }

  const sufficient = parsed.data.sufficient && articleIds.length > 0;

  return {
    ok: true,
    data: {
      answer: sufficient ? answerText : answerText || SUPPORT_INSUFFICIENT_ANSWER,
      articleIds,
      sufficient,
    },
  };
}
