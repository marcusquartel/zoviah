/**
 * Support-assistant config — SERVER ONLY. The support bot runs on its own
 * model knob (`ANTHROPIC_SUPPORT_MODEL`) so its cost, latency and quality can
 * be tuned independently; the key is `ANTHROPIC_API_KEY`.
 */
export const SUPPORT_TIMEOUT_MS = 45_000;

/** The support bot is usable only when both the key and its own model are set. */
export function isSupportAiConfigured(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_SUPPORT_MODEL,
  );
}

/** Model name is not a secret — safe to show to a platform admin. */
export function getSupportModelName(): string | null {
  return process.env.ANTHROPIC_SUPPORT_MODEL ?? null;
}

export function getSupportAiConfig(): {
  apiKey: string;
  model: string;
  workspaceId: string | null;
} {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_SUPPORT_MODEL;
  if (!apiKey || !model) {
    throw new Error(
      "Assistente de suporte não configurado: defina ANTHROPIC_API_KEY e ANTHROPIC_SUPPORT_MODEL.",
    );
  }
  return {
    apiKey,
    model,
    workspaceId: process.env.ANTHROPIC_WORKSPACE_ID || null,
  };
}
