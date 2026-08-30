"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { isSupportAiConfigured } from "@/lib/anthropic/support-env";
import {
  answerSupportQuestion,
  type SupportMessageFn,
} from "@/lib/anthropic/support-assistant";
import { SUPPORT_INSUFFICIENT_ANSWER } from "@/features/support/prompt";
import type { RetrievedArticle } from "@/features/support/prompt";

export interface SupportActionResult {
  ok: boolean;
  error?: string;
}

const RPC_ERRORS: Record<string, string> = {
  FORBIDDEN: "Você não tem acesso a este recurso.",
  NOT_AUTHENTICATED: "Sessão expirada. Entre novamente.",
  CONVERSATION_NOT_FOUND: "Conversa não encontrada.",
  INVALID_TYPE: "Tipo inválido.",
  INVALID_SUBJECT: "Assunto inválido.",
  INVALID_DESCRIPTION: "Descrição inválida.",
};

function mapError(message: string | undefined): string {
  if (message) {
    for (const key of Object.keys(RPC_ERRORS)) {
      if (message.includes(key)) return RPC_ERRORS[key];
    }
  }
  return "Não foi possível concluir a ação.";
}

export interface AskResult extends SupportActionResult {
  conversationId?: string;
  answer?: string;
  sufficient?: boolean;
  /** True when the model call itself failed — UI offers human support directly. */
  assistantUnavailable?: boolean;
}

const askSchema = z.object({
  question: z.string().trim().min(3).max(4000),
  route: z.string().trim().max(200).optional(),
  module: z.string().trim().max(60).optional(),
  conversationId: z.uuid().optional(),
});

/**
 * One question → one answer. Retrieves published articles, calls the support
 * model (separate ANTHROPIC_SUPPORT_MODEL — never Creator Score credits, §14),
 * persists the turn. `messageFn` is injected only by tests.
 */
export async function askAssistant(
  input: {
    question: string;
    route?: string;
    module?: string;
    conversationId?: string;
  },
  messageFn?: SupportMessageFn,
): Promise<AskResult> {
  const parsed = askSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Nenhuma organização ativa." };

  const supabase = await createClient();

  // Open or reuse the conversation.
  let conversationId = parsed.data.conversationId;
  if (!conversationId) {
    const { data, error } = await supabase.rpc("support_start_conversation", {
      p_organization_id: current.organization.id,
      p_route: parsed.data.route ?? "",
      p_module: parsed.data.module ?? "",
    });
    if (error) return { ok: false, error: mapError(error.message) };
    conversationId = (data as { conversation_id?: string })?.conversation_id;
    if (!conversationId) return { ok: false, error: "Falha ao abrir conversa." };
  }

  // Retrieve knowledge.
  const { data: hits } = await supabase.rpc("search_help_articles", {
    p_query: parsed.data.question,
    p_limit: 6,
  });
  const articles: RetrievedArticle[] = Array.isArray(hits)
    ? (hits as unknown as RetrievedArticle[]).map((a) => ({
        id: a.id,
        title: a.title,
        category: a.category,
        content: a.content,
      }))
    : [];

  // If the AI is not configured at all, degrade gracefully to human support.
  if (!isSupportAiConfigured() && !messageFn) {
    await supabase.rpc("support_record_failure", {
      p_conversation_id: conversationId,
      p_user_content: parsed.data.question,
    });
    return {
      ok: true,
      conversationId,
      answer: SUPPORT_INSUFFICIENT_ANSWER,
      sufficient: false,
      assistantUnavailable: true,
    };
  }

  const result = await answerSupportQuestion(parsed.data.question, articles, {
    messageFn,
    context: { route: parsed.data.route, module: parsed.data.module },
  });

  if (result.failed) {
    await supabase.rpc("support_record_failure", {
      p_conversation_id: conversationId,
      p_user_content: parsed.data.question,
    });
    return {
      ok: true,
      conversationId,
      answer: SUPPORT_INSUFFICIENT_ANSWER,
      sufficient: false,
      assistantUnavailable: true,
    };
  }

  const { error: appendErr } = await supabase.rpc("support_append_message", {
    p_conversation_id: conversationId,
    p_user_content: parsed.data.question,
    p_assistant_content: result.answer.answer,
    p_article_refs: result.answer.articleIds,
    p_model: result.model,
    p_input_tokens: result.inputTokens,
    p_output_tokens: result.outputTokens,
    p_latency_ms: result.latencyMs,
  });
  if (appendErr) return { ok: false, error: mapError(appendErr.message) };

  return {
    ok: true,
    conversationId,
    answer: result.answer.answer,
    sufficient: result.answer.sufficient,
  };
}

export async function sendFeedback(
  conversationId: string,
  resolved: boolean,
): Promise<SupportActionResult> {
  if (!z.uuid().safeParse(conversationId).success) {
    return { ok: false, error: "Conversa inválida." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("support_feedback", {
    p_conversation_id: conversationId,
    p_resolved: resolved,
  });
  if (error) return { ok: false, error: mapError(error.message) };
  return { ok: true };
}

const escalateSchema = z.object({
  conversationId: z.uuid(),
  type: z.enum(["question", "account", "bug", "feature_request", "other"]),
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(8000),
});

export interface EscalateResult extends SupportActionResult {
  ticketId?: string;
}

export async function escalateToTicket(input: {
  conversationId: string;
  type: string;
  subject: string;
  description: string;
}): Promise<EscalateResult> {
  const parsed = escalateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("support_escalate", {
    p_conversation_id: parsed.data.conversationId,
    p_type: parsed.data.type,
    p_subject: parsed.data.subject,
    p_description: parsed.data.description,
  });
  if (error) return { ok: false, error: mapError(error.message) };
  revalidatePath("/app");
  return { ok: true, ticketId: (data as { ticket_id?: string })?.ticket_id };
}
