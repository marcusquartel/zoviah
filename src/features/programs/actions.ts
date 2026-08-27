"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { fieldKeyify, slugify } from "@/lib/slug";
import { mappingsForFieldType } from "@/lib/form-fields";
import {
  addFieldSchema,
  programGeneralSchema,
  updateFieldSchema,
} from "@/lib/validation/programs";
import type { Database, FieldType, ProgramStatus } from "@/types/database";

type Db = SupabaseClient<Database>;

export interface ActionState {
  error?: string;
  success?: boolean;
}

async function requireAdmin(): Promise<
  { ok: true; orgId: string; supabase: Db } | { ok: false; error: string }
> {
  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };
  if (current.role === "analyst") {
    return { ok: false, error: "Você não tem permissão para esta ação." };
  }
  const supabase = await createClient();
  return { ok: true, orgId: current.organization.id, supabase };
}

/** Increment programs.form_version (structural form change). */
async function bumpFormVersion(supabase: Db, programId: string): Promise<void> {
  const { data } = await supabase
    .from("programs")
    .select("form_version")
    .eq("id", programId)
    .maybeSingle();
  const next = (data?.form_version ?? 1) + 1;
  await supabase
    .from("programs")
    .update({ form_version: next })
    .eq("id", programId);
}

async function uniqueSlug(
  supabase: Db,
  orgId: string,
  base: string,
  ignoreId?: string,
): Promise<string> {
  const root = slugify(base) || "programa";
  const { data } = await supabase
    .from("programs")
    .select("id, slug")
    .eq("organization_id", orgId)
    .like("slug", `${root}%`);
  const taken = new Set(
    (data ?? []).filter((r) => r.id !== ignoreId).map((r) => r.slug),
  );
  if (!taken.has(root)) return root;
  for (let i = 2; i < 500; i += 1) {
    if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
  }
  return `${root}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------
export async function createProgram(): Promise<void> {
  const auth = await requireAdmin();
  if (!auth.ok) throw new Error(auth.error);

  const slug = await uniqueSlug(auth.supabase, auth.orgId, "novo-programa");
  const { data, error } = await auth.supabase
    .from("programs")
    .insert({
      organization_id: auth.orgId,
      name: "Novo programa",
      slug,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("Não foi possível criar o programa.");

  revalidatePath("/app/programs");
  redirect(`/app/programs/${data.id}/general`);
}

export async function updateProgram(
  programId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const parsed = programGeneralSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") ?? "",
    public_title: formData.get("public_title") ?? "",
    public_description: formData.get("public_description") ?? "",
    success_message: formData.get("success_message") ?? "",
    status: formData.get("status"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const v = parsed.data;

  if (v.status === "active") {
    const guard = await ensureActivatable(auth.supabase, programId);
    if (guard) return { error: guard };
  }

  const { error } = await auth.supabase
    .from("programs")
    .update({
      name: v.name,
      slug: v.slug,
      description: v.description || null,
      public_title: v.public_title || null,
      public_description: v.public_description || null,
      success_message: v.success_message || null,
      status: v.status,
      archived_at: v.status === "archived" ? new Date().toISOString() : null,
    })
    .eq("organization_id", auth.orgId)
    .eq("id", programId);

  if (error) {
    if (error.code === "23505") {
      return { error: "Já existe um programa com esse slug nesta organização." };
    }
    return { error: "Não foi possível salvar o programa." };
  }

  revalidatePath("/app/programs");
  revalidatePath(`/app/programs/${programId}`, "layout");
  return { success: true };
}

export async function setProgramStatus(
  programId: string,
  status: ProgramStatus,
): Promise<ActionState> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  if (status === "active") {
    const guard = await ensureActivatable(auth.supabase, programId);
    if (guard) return { error: guard };
  }

  const { error } = await auth.supabase
    .from("programs")
    .update({
      status,
      archived_at: status === "archived" ? new Date().toISOString() : null,
    })
    .eq("organization_id", auth.orgId)
    .eq("id", programId);

  if (error) return { error: "Não foi possível alterar o status." };

  revalidatePath("/app/programs");
  revalidatePath(`/app/programs/${programId}`, "layout");
  return { success: true };
}

/** Returns an error string if the program is not ready to go live, else null. */
async function ensureActivatable(
  supabase: Db,
  programId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("form_fields")
    .select("field_type, configuration, active")
    .eq("program_id", programId)
    .eq("active", true);

  const fields = data ?? [];
  if (fields.length === 0) {
    return "Adicione ao menos um campo ao formulário antes de ativar.";
  }
  const hasName = fields.some(
    (f) => (f.configuration as { mapping?: string } | null)?.mapping === "full_name",
  );
  if (!hasName) {
    return 'Configure um campo mapeado para "Nome completo" antes de ativar.';
  }
  return null;
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------
export async function addFormField(
  programId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const parsed = addFieldSchema.safeParse({
    label: formData.get("label"),
    field_type: formData.get("field_type"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { label, field_type } = parsed.data;

  const { data: existing } = await auth.supabase
    .from("form_fields")
    .select("field_key, position")
    .eq("program_id", programId);
  const keys = new Set((existing ?? []).map((f) => f.field_key));
  let key = fieldKeyify(label);
  for (let i = 2; keys.has(key); i += 1) key = `${fieldKeyify(label)}_${i}`;
  const position =
    Math.max(0, ...(existing ?? []).map((f) => f.position)) + 1;

  const autoMapping = mappingsForFieldType(field_type as FieldType);
  const configuration =
    autoMapping.length === 1 ? { mapping: autoMapping[0] } : {};

  const { error } = await auth.supabase.from("form_fields").insert({
    organization_id: auth.orgId,
    program_id: programId,
    field_key: key,
    label,
    field_type,
    required: false,
    position,
    configuration,
    options: (field_type === "single_select" || field_type === "multi_select")
      ? []
      : null,
  });

  if (error) return { error: "Não foi possível adicionar o campo." };

  await bumpFormVersion(auth.supabase, programId);
  revalidatePath(`/app/programs/${programId}/form`);
  return { success: true };
}

export async function updateFormField(
  fieldId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  let options: unknown = [];
  try {
    options = JSON.parse(String(formData.get("options") ?? "[]"));
  } catch {
    options = [];
  }

  const rawMapping = String(formData.get("mapping") ?? "");
  const parsed = updateFieldSchema.safeParse({
    field_key: formData.get("field_key"),
    label: formData.get("label"),
    field_type: formData.get("field_type"),
    placeholder: formData.get("placeholder") ?? "",
    help_text: formData.get("help_text") ?? "",
    required:
      formData.get("required") === "on" || formData.get("required") === "true",
    mapping: rawMapping && rawMapping !== "__none__" ? rawMapping : undefined,
    options,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const v = parsed.data;

  if (
    (v.field_type === "single_select" || v.field_type === "multi_select") &&
    v.options.length === 0
  ) {
    return { error: "Adicione ao menos uma opção para este tipo de campo." };
  }

  const { data: before } = await auth.supabase
    .from("form_fields")
    .select("program_id, field_key, field_type, required, options")
    .eq("id", fieldId)
    .eq("organization_id", auth.orgId)
    .maybeSingle();
  if (!before) return { error: "Campo não encontrado." };

  const { error } = await auth.supabase
    .from("form_fields")
    .update({
      field_key: v.field_key,
      label: v.label,
      field_type: v.field_type,
      placeholder: v.placeholder || null,
      help_text: v.help_text || null,
      required: v.required,
      configuration: v.mapping ? { mapping: v.mapping } : {},
      options:
        v.field_type === "single_select" || v.field_type === "multi_select"
          ? v.options
          : null,
    })
    .eq("id", fieldId)
    .eq("organization_id", auth.orgId);

  if (error) {
    if (error.code === "23505") {
      return { error: "Já existe um campo com essa chave neste programa." };
    }
    return { error: "Não foi possível salvar o campo." };
  }

  const structural =
    before.field_key !== v.field_key ||
    before.field_type !== v.field_type ||
    before.required !== v.required ||
    JSON.stringify(before.options ?? []) !== JSON.stringify(v.options);
  if (structural) await bumpFormVersion(auth.supabase, before.program_id);

  revalidatePath(`/app/programs/${before.program_id}/form`);
  return { success: true };
}

export async function toggleFormField(
  fieldId: string,
  active: boolean,
): Promise<ActionState> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const { data, error } = await auth.supabase
    .from("form_fields")
    .update({ active })
    .eq("id", fieldId)
    .eq("organization_id", auth.orgId)
    .select("program_id")
    .maybeSingle();

  if (error || !data) return { error: "Não foi possível atualizar o campo." };

  await bumpFormVersion(auth.supabase, data.program_id);
  revalidatePath(`/app/programs/${data.program_id}/form`);
  return { success: true };
}

export async function deleteFormField(fieldId: string): Promise<ActionState> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const { data: field } = await auth.supabase
    .from("form_fields")
    .select("program_id")
    .eq("id", fieldId)
    .eq("organization_id", auth.orgId)
    .maybeSingle();
  if (!field) return { error: "Campo não encontrado." };

  const { error } = await auth.supabase
    .from("form_fields")
    .delete()
    .eq("id", fieldId)
    .eq("organization_id", auth.orgId);

  if (error) return { error: "Não foi possível remover o campo." };

  await bumpFormVersion(auth.supabase, field.program_id);
  revalidatePath(`/app/programs/${field.program_id}/form`);
  return { success: true };
}

export async function moveFormField(
  fieldId: string,
  direction: "up" | "down",
): Promise<ActionState> {
  const auth = await requireAdmin();
  if (!auth.ok) return { error: auth.error };

  const { data: field } = await auth.supabase
    .from("form_fields")
    .select("program_id, position")
    .eq("id", fieldId)
    .eq("organization_id", auth.orgId)
    .maybeSingle();
  if (!field) return { error: "Campo não encontrado." };

  const { data: siblings } = await auth.supabase
    .from("form_fields")
    .select("id, position")
    .eq("program_id", field.program_id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  const ordered = siblings ?? [];
  const index = ordered.findIndex((f) => f.id === fieldId);
  const swapWith = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || swapWith < 0 || swapWith >= ordered.length) {
    return { success: true };
  }

  const a = ordered[index];
  const b = ordered[swapWith];
  // Normalize positions to their array index to avoid drift over time.
  await auth.supabase
    .from("form_fields")
    .update({ position: swapWith })
    .eq("id", a.id)
    .eq("organization_id", auth.orgId);
  await auth.supabase
    .from("form_fields")
    .update({ position: index })
    .eq("id", b.id)
    .eq("organization_id", auth.orgId);

  await bumpFormVersion(auth.supabase, field.program_id);
  revalidatePath(`/app/programs/${field.program_id}/form`);
  return { success: true };
}
