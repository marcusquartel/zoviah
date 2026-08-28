/**
 * Qualitative analysis boundary. The ONLY place the Anthropic SDK is called.
 * UI never imports this; server actions call `runQualitativeAnalysis`.
 *
 * `messageFn` is injectable so tests can run the whole pipeline (payload →
 * parse → validate → retry) deterministically without a paid API call (§81).
 */
import Anthropic from "@anthropic-ai/sdk";
import {
  ANTHROPIC_TIMEOUT_MS,
  getAnthropicConfig,
} from "./env.ts";
import {
  RETRY_MESSAGE,
  SYSTEM_PROMPT,
  buildUserMessage,
} from "../../features/analysis/prompt.ts";
import {
  parseQualitative,
  type QualitativeOutput,
} from "../../features/analysis/qualitative-schema.ts";
import type { ClaudePayload } from "../../features/analysis/sanitize.ts";

export interface MessageRequest {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

export interface MessageResponse {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export type MessageFn = (req: MessageRequest) => Promise<MessageResponse>;

export interface QualitativeResult {
  output: QualitativeOutput;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
}

export class QualitativeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "QualitativeError";
    this.code = code;
  }
}

/** Real Anthropic call. */
export function anthropicMessageFn(): MessageFn {
  const { apiKey, model } = getAnthropicConfig();
  const client = new Anthropic({
    apiKey,
    timeout: ANTHROPIC_TIMEOUT_MS,
    maxRetries: 1, // SDK retries transient 429/5xx once (§38)
  });

  return async (req) => {
    const res = await client.messages.create({
      model,
      max_tokens: 4000,
      system: req.system,
      messages: req.messages,
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return {
      text,
      model: res.model,
      inputTokens: res.usage?.input_tokens ?? null,
      outputTokens: res.usage?.output_tokens ?? null,
    };
  };
}

function classifyError(err: unknown): QualitativeError {
  if (err instanceof QualitativeError) return err;
  if (err instanceof Anthropic.APIError) {
    const status = err.status ?? 0;
    if (status === 401) return new QualitativeError("auth", "Credencial inválida.");
    if (status === 429) return new QualitativeError("rate_limit", "Limite de uso atingido.");
    if (status >= 500) return new QualitativeError("upstream", "Serviço de IA indisponível.");
    if (status === 400) return new QualitativeError("bad_request", "Requisição rejeitada pela IA.");
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return new QualitativeError("timeout", "Tempo limite excedido.");
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new QualitativeError("connection", "Falha de conexão com a IA.");
  }
  return new QualitativeError("unknown", "Erro inesperado na análise.");
}

/**
 * Run the qualitative pass: one call, and at most ONE corrective retry when the
 * output is not valid JSON in the required shape (§32, §38).
 */
export async function runQualitativeAnalysis(
  payload: ClaudePayload,
  messageFn: MessageFn = anthropicMessageFn(),
): Promise<QualitativeResult> {
  const startedAt = Date.now();
  const userMessage = buildUserMessage(payload);

  let response: MessageResponse;
  try {
    response = await messageFn({
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err) {
    throw classifyError(err);
  }

  let parsed = parseQualitative(response.text);

  if (!parsed.ok) {
    try {
      response = await messageFn({
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: `${userMessage}\n\n${RETRY_MESSAGE}` },
        ],
      });
    } catch (err) {
      throw classifyError(err);
    }
    parsed = parseQualitative(response.text);
  }

  if (!parsed.ok) {
    throw new QualitativeError(
      "invalid_output",
      `A IA retornou um resultado inválido (${parsed.error}).`,
    );
  }

  return {
    output: parsed.data,
    model: response.model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    latencyMs: Date.now() - startedAt,
  };
}
