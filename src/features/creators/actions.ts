"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { APPLICATION_STATUSES } from "@/features/applications/status";
import type { ApplicationStatus } from "@/types/database";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

const transitionSchema = z.object({
  applicationId: z.uuid(),
  toStatus: z.enum(APPLICATION_STATUSES as [ApplicationStatus, ...ApplicationStatus[]]),
  note: z.string().trim().max(4000).optional(),
});

const noteSchema = z.object({
  creatorId: z.uuid(),
  applicationId: z.uuid().optional(),
  text: z.string().trim().min(1, { error: "Escreva a nota." }).max(4000),
});

const TRANSITION_ERRORS: Record<string, string> = {
  USE_ADDRESS_REQUEST_FLOW:
    "Use a aba Endereço para solicitar ou concluir o endereço.",
  INVALID_TRANSITION: "Essa mudança de status não é permitida.",
  FORBIDDEN: "Você não tem acesso a esta inscrição.",
  APPLICATION_NOT_FOUND: "Inscrição não encontrada.",
  NOT_AUTHENTICATED: "Sessão expirada. Entre novamente.",
};

function mapRpcError(message: string | undefined): string {
  if (!message) return "Não foi possível concluir a ação.";
  for (const key of Object.keys(TRANSITION_ERRORS)) {
    if (message.includes(key)) return TRANSITION_ERRORS[key];
  }
  return "Não foi possível concluir a ação.";
}

/**
 * The single entry point for changing an application's status. Delegates to the
 * `transition_application_status` RPC (atomic: updates the row + writes the
 * audit event; validates membership + the transition table itself).
 */
export async function transitionApplicationStatus(input: {
  applicationId: string;
  toStatus: ApplicationStatus;
  note?: string;
}): Promise<ActionResult> {
  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_application_status", {
    p_application_id: parsed.data.applicationId,
    p_to_status: parsed.data.toStatus,
    p_note: parsed.data.note && parsed.data.note.length > 0 ? parsed.data.note : undefined,
  });

  if (error) {
    console.error("[transition_application_status]", error.code, error.message);
    return { ok: false, error: mapRpcError(error.message) };
  }

  revalidatePath("/app/creators");
  revalidatePath("/app");
  return { ok: true };
}

export async function addCreatorNote(input: {
  creatorId: string;
  text: string;
  applicationId?: string;
}): Promise<ActionResult> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_creator_note", {
    p_creator_id: parsed.data.creatorId,
    p_text: parsed.data.text,
    p_application_id: parsed.data.applicationId,
  });

  if (error) {
    console.error("[add_creator_note]", error.code, error.message);
    return { ok: false, error: mapRpcError(error.message) };
  }

  revalidatePath("/app/creators");
  return { ok: true };
}
