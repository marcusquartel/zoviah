"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { getApplicationDetail } from "@/features/creators/queries";
import { getFormFields, getProgram } from "@/features/programs/queries";
import {
  ANTHROPIC_PROVIDER,
  getAnthropicModelName,
  isAnthropicConfigured,
} from "@/lib/anthropic/env";
import {
  QualitativeError,
  runQualitativeAnalysis,
  type MessageFn,
} from "@/lib/anthropic/creator-analysis";
import { PROMPT_VERSION, SCORING_VERSION } from "@/features/analysis/criteria";
import {
  buildClaudePayload,
  sanitizeEvidence,
} from "@/features/analysis/sanitize";
import { computeObjectiveCriteria } from "@/features/analysis/objective";
import { combineAnalysis, toCompletionResult } from "@/features/analysis/analyze";

export interface AnalyzeResult {
  ok: boolean;
  error?: string;
}

const START_ERRORS: Record<string, string> = {
  ANALYSIS_IN_PROGRESS: "Esta creator já está sendo analisada.",
  FORBIDDEN: "Você não tem acesso a esta inscrição.",
  APPLICATION_NOT_FOUND: "Inscrição não encontrada.",
  NOT_AUTHENTICATED: "Sessão expirada. Entre novamente.",
};

/**
 * The full analysis flow (§41). The external call happens BETWEEN two short DB
 * operations — no transaction is held open across the network (§42).
 * `messageFn` is only injected by the smoke test; production uses the default.
 */
export async function analyzeApplication(
  applicationId: string,
  messageFn?: MessageFn,
): Promise<AnalyzeResult> {
  if (!isAnthropicConfigured()) {
    return { ok: false, error: "IA não configurada." };
  }

  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };

  const detail = await getApplicationDetail(applicationId);
  if (!detail) return { ok: false, error: "Inscrição não encontrada." };

  const [formFields, program] = await Promise.all([
    getFormFields(detail.program.id),
    getProgram(detail.program.id),
  ]);
  const supabase = await createClient();
  const model = getAnthropicModelName() ?? "";

  // 1. sanitize + deterministic criteria (before reserving the slot)
  const evidence = sanitizeEvidence({
    program: {
      name: detail.program.name,
      description: program?.description ?? null,
      public_description: program?.public_description ?? null,
    },
    creator: detail.creator,
    socials: detail.socials,
    application: detail.application,
    formFields,
  });
  const payload = buildClaudePayload(evidence);
  const objective = computeObjectiveCriteria(evidence);

  // 2. reserve the processing slot (concurrency guard lives in the RPC)
  const start = await supabase.rpc("start_creator_analysis", {
    p_application_id: applicationId,
    p_provider: ANTHROPIC_PROVIDER,
    p_model: model,
    p_prompt_version: PROMPT_VERSION,
    p_scoring_version: SCORING_VERSION,
  });
  if (start.error) {
    const key = Object.keys(START_ERRORS).find((k) =>
      start.error!.message.includes(k),
    );
    console.error("[analyzeApplication] start", start.error.code, start.error.message);
    return { ok: false, error: key ? START_ERRORS[key] : "Não foi possível iniciar a análise." };
  }
  const analysisId = (start.data as { analysis_id: string }).analysis_id;

  // 3. external call — NO db transaction held here
  try {
    const qualitative = await runQualitativeAnalysis(payload, messageFn);
    const combined = combineAnalysis(objective, qualitative.output);
    const result = toCompletionResult(combined, {
      model: qualitative.model,
      inputTokens: qualitative.inputTokens,
      outputTokens: qualitative.outputTokens,
      latencyMs: qualitative.latencyMs,
      inputSnapshot: payload,
      rawResult: qualitative.output,
    });

    // 4. persist + update cache atomically
    const complete = await supabase.rpc("complete_creator_analysis", {
      p_analysis_id: analysisId,
      p_result: result as never,
    });
    if (complete.error) {
      throw new QualitativeError("persist", complete.error.message);
    }
  } catch (err) {
    const code = err instanceof QualitativeError ? err.code : "unknown";
    await supabase.rpc("fail_creator_analysis", {
      p_analysis_id: analysisId,
      p_error_code: code,
      p_error_message:
        err instanceof Error ? err.message.slice(0, 300) : "erro",
    });
    console.error("[analyzeApplication]", code, err);
    return {
      ok: false,
      error: "Não foi possível concluir a análise. Tente novamente.",
    };
  }

  revalidatePath("/app/creators");
  revalidatePath("/app");
  revalidatePath("/app/ai");
  return { ok: true };
}
