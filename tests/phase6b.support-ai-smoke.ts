/**
 * FASE 6B — support assistant smoke. AT MOST ONE real Anthropic call (§68).
 *
 * Runs only when ANTHROPIC_API_KEY and ANTHROPIC_SUPPORT_MODEL are set. NOT in
 * the standard `npm test` glob — invoked on demand via
 * `npm run test:support-ai:smoke`. No Supabase, no tenant data: a hard-coded
 * article goes in, a parsed answer comes out.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { answerSupportQuestion } from "../src/lib/anthropic/support-assistant.ts";
import { supportMessageFn } from "../src/lib/anthropic/support-assistant.ts";
import { SUPPORT_INSUFFICIENT_ANSWER } from "../src/features/support/prompt.ts";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local */
}

const ready = Boolean(
  process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_SUPPORT_MODEL,
);
const skip = ready
  ? false
  : "ANTHROPIC_API_KEY / ANTHROPIC_SUPPORT_MODEL not set";

const ARTICLE = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  title: "Como solicitar o endereço de um creator",
  category: "Endereço",
  content:
    "Na ficha do creator, clique em 'Solicitar endereço'. O creator recebe um link seguro e privado para preencher o endereço. Assim que ele conclui, o endereço aparece na aba Endereço da ficha e fica disponível para criar um envio.",
};

describe("Phase 6B — support AI smoke", { skip }, () => {
  test("one real call: grounded answer cites the article and is 'sufficient'", async () => {
    const res = await answerSupportQuestion(
      "Como faço para pedir o endereço de um creator aprovado?",
      [ARTICLE],
      { messageFn: supportMessageFn() },
    );
    assert.equal(res.failed, false);
    assert.ok(res.latencyMs > 0);
    assert.ok((res.inputTokens ?? 0) > 0, "input tokens recorded (§14)");
    assert.ok((res.outputTokens ?? 0) > 0, "output tokens recorded (§14)");
    assert.ok(res.model && res.model !== "none");
    assert.ok(res.answer.answer.length > 0);
    // The docs cover this question, so the model should have leaned on them.
    assert.deepEqual(res.answer.articleIds, [ARTICLE.id]);
    assert.equal(res.answer.sufficient, true);
    assert.notEqual(res.answer.answer, SUPPORT_INSUFFICIENT_ANSWER);
  });
});
