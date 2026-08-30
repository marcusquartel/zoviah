"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";

export interface ProductActionResult {
  ok: boolean;
  error?: string;
}

function mapError(message: string | undefined): string {
  if (message?.includes("FORBIDDEN")) return "Você não tem acesso a este recurso.";
  if (message?.includes("NOT_AUTHENTICATED")) return "Sessão expirada. Entre novamente.";
  if (message?.includes("REQUEST_NOT_FOUND")) return "Sugestão não encontrada.";
  if (message?.includes("INVALID_TITLE")) return "Título inválido.";
  if (message?.includes("INVALID_PROBLEM")) return "Descreva o problema com mais detalhe.";
  return "Não foi possível concluir a ação.";
}

const submitSchema = z.object({
  title: z.string().trim().min(4).max(160),
  problem: z.string().trim().min(10).max(4000),
  useCase: z.string().trim().max(4000).optional(),
  frequency: z.enum(["rarely", "sometimes", "often", "daily"]),
  importance: z.enum(["nice_to_have", "important", "essential"]),
});

export interface SubmitResult extends ProductActionResult {
  id?: string;
}

export async function submitFeatureRequest(input: {
  title: string;
  problem: string;
  useCase?: string;
  frequency: string;
  importance: string;
}): Promise<SubmitResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Nenhuma organização ativa." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_feature_request", {
    p_organization_id: current.organization.id,
    p_title: parsed.data.title,
    p_problem: parsed.data.problem,
    p_use_case: parsed.data.useCase ?? null,
    p_frequency: parsed.data.frequency,
    p_importance: parsed.data.importance,
  });
  if (error) return { ok: false, error: mapError(error.message) };
  revalidatePath("/app/suggestions");
  return { ok: true, id: (data as { id?: string })?.id };
}

/** §37 — toggles the caller ORGANIZATION's single vote, not the user's. */
export async function voteFeatureRequest(
  requestId: string,
  vote: boolean,
): Promise<ProductActionResult & { voteCount?: number }> {
  if (!z.uuid().safeParse(requestId).success) {
    return { ok: false, error: "Sugestão inválida." };
  }
  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Nenhuma organização ativa." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("vote_feature_request", {
    p_organization_id: current.organization.id,
    p_request_id: requestId,
    p_vote: vote,
  });
  if (error) return { ok: false, error: mapError(error.message) };
  revalidatePath("/app/suggestions");
  return { ok: true, voteCount: (data as { vote_count?: number })?.vote_count };
}
