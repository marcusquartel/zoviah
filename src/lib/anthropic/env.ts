/**
 * Anthropic config — SERVER ONLY. Never referenced by browser code.
 * The key is never logged, never returned to the client, never stored.
 */
const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.ANTHROPIC_MODEL;

/** Both the key and the model must be set for the IA feature to be usable. */
export function isAnthropicConfigured(): boolean {
  return Boolean(apiKey && model);
}

/** The model name is not a secret — safe to show in the UI. */
export function getAnthropicModelName(): string | null {
  return model ?? null;
}

export function getAnthropicConfig(): { apiKey: string; model: string } {
  if (!apiKey || !model) {
    throw new Error(
      "IA não configurada: defina ANTHROPIC_API_KEY e ANTHROPIC_MODEL no ambiente.",
    );
  }
  return { apiKey, model };
}

export const ANTHROPIC_PROVIDER = "anthropic";
export const ANTHROPIC_TIMEOUT_MS = 60_000;
