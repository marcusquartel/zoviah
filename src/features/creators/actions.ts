"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { APPLICATION_STATUSES } from "@/features/applications/status";
import { buildFieldSchema, type PublicFieldDef } from "@/lib/form-fields";
import { buildApplicationPayload } from "@/lib/application-payload";
import { mapSubmitApplicationError } from "@/lib/submit-application-errors";
import type { ApplicationStatus, Json } from "@/types/database";

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

export interface CreateCreatorResult extends ActionResult {
  possibleDuplicate?: boolean;
}

/**
 * Manual entry / spreadsheet-import row — both funnel through this. Same
 * `submit_application` RPC the public form uses (dedup, caps, rate limits
 * included), just called with the staff member's own session instead of the
 * anon key, and the org/program slugs resolved server-side, never trusted
 * from the caller.
 */
export async function createCreatorManually(
  programId: string,
  answers: Record<string, unknown>,
): Promise<CreateCreatorResult> {
  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };

  const supabase = await createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, slug, status, form_version")
    .eq("organization_id", current.organization.id)
    .eq("id", programId)
    .maybeSingle();
  if (!program) return { ok: false, error: "Programa não encontrado." };
  if (program.status !== "active") {
    return {
      ok: false,
      error: "Só é possível adicionar creators em programas ativos.",
    };
  }

  const { data: fieldRows } = await supabase
    .from("form_fields")
    .select(
      "field_key, label, field_type, placeholder, help_text, required, options, configuration, position",
    )
    .eq("organization_id", current.organization.id)
    .eq("program_id", programId)
    .eq("active", true)
    .order("position", { ascending: true });
  const fields = (fieldRows ?? []) as PublicFieldDef[];
  if (fields.length === 0) {
    return { ok: false, error: "Este programa não tem campos ativos no formulário." };
  }

  const schema = buildFieldSchema(fields, { consent: false });
  const parsed = schema.safeParse(answers);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revise os campos destacados.",
    };
  }

  const { answersClean, creator, socials, fieldSnapshot } =
    buildApplicationPayload(fields, parsed.data);

  const { data: rpc, error } = await supabase.rpc("submit_application", {
    p_org_slug: current.organization.slug,
    p_program_slug: program.slug,
    p_form_version: program.form_version,
    p_answers: answersClean as Json,
    p_field_snapshot: fieldSnapshot as Json,
    p_creator: creator as Json,
    p_socials: socials as Json,
    p_utm: {} as Json,
    p_referrer: null,
    p_source: "manual",
  });

  if (error) {
    const mapped = mapSubmitApplicationError(error.message);
    if (!mapped) {
      console.error("[createCreatorManually] unexpected error", {
        code: error.code,
        message: error.message,
      });
    }
    return { ok: false, error: mapped ?? "Não foi possível criar a inscrição." };
  }

  revalidatePath("/app/creators");
  const result = (rpc ?? {}) as { possible_duplicate?: boolean };
  return { ok: true, possibleDuplicate: result.possible_duplicate ?? false };
}
