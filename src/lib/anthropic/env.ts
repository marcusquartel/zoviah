/**
 * Anthropic config — SERVER ONLY. Never referenced by browser code.
 * The key is never logged, never returned to the client, never stored.
 *
 * `process.env` is read lazily (inside the functions), so a test that calls
 * `process.loadEnvFile()` after importing this module still sees the values.
 */
export const ANTHROPIC_PROVIDER = "anthropic";
export const ANTHROPIC_TIMEOUT_MS = 60_000;

/** Both the key and the model must be set for the IA feature to be usable. */
export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_MODEL);
}

/** The model name is not a secret — safe to show in the UI. */
export function getAnthropicModelName(): string | null {
  return process.env.ANTHROPIC_MODEL ?? null;
}

export function getAnthropicConfig(): {
  apiKey: string;
  model: string;
  /** Required for identity-linked API keys; optional otherwise. */
  workspaceId: string | null;
} {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_MODEL;
  if (!apiKey || !model) {
    throw new Error(
      "IA não configurada: defina ANTHROPIC_API_KEY e ANTHROPIC_MODEL no ambiente.",
    );
  }
  return {
    apiKey,
    model,
    workspaceId: process.env.ANTHROPIC_WORKSPACE_ID || null,
  };
}
