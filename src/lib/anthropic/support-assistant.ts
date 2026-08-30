/**
 * Support assistant boundary. The ONLY place the Anthropic SDK is called for
 * support. The server action calls `answerSupportQuestion`; the UI never
 * imports this.
 *
 * `messageFn` is injectable so the whole pipeline (retrieve → prompt → parse →
 * one corrective retry) runs deterministically in tests with ZERO paid calls
 * (§68). The standard suite always injects a mock.
 *
 * This module NEVER reads tenant data. It is handed a question and a list of
 * already-retrieved help articles; it has no Supabase client, no RPC access,
 * no filesystem access.
 */
import Anthropic from "@anthropic-ai/sdk";
import { getSupportAiConfig, SUPPORT_TIMEOUT_MS } from "./support-env.ts";
import {
  SUPPORT_SYSTEM_PROMPT,
  SUPPORT_RETRY_MESSAGE,
  SUPPORT_INSUFFICIENT_ANSWER,
  SUPPORT_PROMPT_VERSION,
  buildSupportUserMessage,
  type RetrievedArticle,
} from "../../features/support/prompt.ts";
import {
  parseSupportAnswer,
  type SupportAnswer,
} from "../../features/support/answer-schema.ts";

export interface SupportMessageRequest {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
}

export interface SupportMessageResponse {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
}

export type SupportMessageFn = (
  req: SupportMessageRequest,
) => Promise<SupportMessageResponse>;

export interface SupportResult {
  answer: SupportAnswer;
  promptVersion: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  /** True when the model call itself failed (not the same as an unhelpful answer). */
  failed: boolean;
}

export class SupportAiError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SupportAiError";
    this.code = code;
  }
}

/** Real Anthropic call — uses ANTHROPIC_SUPPORT_MODEL, never ANTHROPIC_MODEL. */
export function supportMessageFn(): SupportMessageFn {
  const { apiKey, model, workspaceId } = getSupportAiConfig();
  const client = new Anthropic({
    apiKey,
    timeout: SUPPORT_TIMEOUT_MS,
    maxRetries: 1,
    defaultHeaders: workspaceId
      ? { "anthropic-workspace-id": workspaceId }
      : undefined,
  });

  return async (req) => {
    const res = await client.messages.create({
      model,
      max_tokens: 1200,
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

const INSUFFICIENT: SupportAnswer = {
  answer: SUPPORT_INSUFFICIENT_ANSWER,
  articleIds: [],
  sufficient: false,
};

/**
 * Answer a support question from retrieved knowledge. One call plus at most one
 * corrective retry on invalid JSON. If retrieval returned nothing, we do not
 * call the model at all — the answer is deterministically "insufficient".
 */
export async function answerSupportQuestion(
  question: string,
  articles: RetrievedArticle[],
  opts: {
    messageFn?: SupportMessageFn;
    context?: { route?: string | null; module?: string | null };
  } = {},
): Promise<SupportResult> {
  const startedAt = Date.now();
  const base = {
    promptVersion: SUPPORT_PROMPT_VERSION,
    model: "none",
    inputTokens: null,
    outputTokens: null,
  };

  if (articles.length === 0) {
    return {
      ...base,
      answer: INSUFFICIENT,
      latencyMs: Date.now() - startedAt,
      failed: false,
    };
  }

  const messageFn = opts.messageFn ?? supportMessageFn();
  const allowedIds = articles.map((a) => a.id);
  const userMessage = buildSupportUserMessage(question, articles, opts.context);

  let response: SupportMessageResponse;
  try {
    response = await messageFn({
      system: SUPPORT_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err) {
    return {
      ...base,
      answer: INSUFFICIENT,
      latencyMs: Date.now() - startedAt,
      failed: true,
      model: classifyCode(err),
    };
  }

  let parsed = parseSupportAnswer(response.text, allowedIds);
  if (!parsed.ok) {
    try {
      response = await messageFn({
        system: SUPPORT_SYSTEM_PROMPT,
        messages: [
          { role: "user", content: `${userMessage}\n\n${SUPPORT_RETRY_MESSAGE}` },
        ],
      });
      parsed = parseSupportAnswer(response.text, allowedIds);
    } catch (err) {
      return {
        ...base,
        answer: INSUFFICIENT,
        latencyMs: Date.now() - startedAt,
        failed: true,
        model: classifyCode(err),
      };
    }
  }

  return {
    promptVersion: SUPPORT_PROMPT_VERSION,
    answer: parsed.ok ? parsed.data : INSUFFICIENT,
    model: response.model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    latencyMs: Date.now() - startedAt,
    failed: false,
  };
}

function classifyCode(err: unknown): string {
  if (err instanceof Anthropic.APIError) return `error:${err.status ?? 0}`;
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "error:timeout";
  if (err instanceof Anthropic.APIConnectionError) return "error:connection";
  return "error:unknown";
}
