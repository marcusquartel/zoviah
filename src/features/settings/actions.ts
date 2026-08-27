"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { appearanceSchema } from "@/lib/validation/appearance";

export interface AppearanceState {
  error?: string;
  success?: boolean;
}

export async function updateAppearance(
  _prevState: AppearanceState,
  formData: FormData,
): Promise<AppearanceState> {
  const parsed = appearanceSchema.safeParse({
    primaryColor: formData.get("primaryColor") ?? "",
    secondaryColor: formData.get("secondaryColor") ?? "",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const current = await getCurrentOrganization();
  if (!current) {
    return { error: "Organização não encontrada." };
  }
  if (current.role === "analyst") {
    return { error: "Você não tem permissão para alterar a aparência." };
  }

  const supabase = await createClient();
  // RLS still enforces that the caller is an owner/admin of this org.
  const { error } = await supabase.from("organization_settings").update({
    primary_color: parsed.data.primaryColor || null,
    secondary_color: parsed.data.secondaryColor || null,
  }).eq("organization_id", current.organization.id);

  if (error) {
    return { error: "Não foi possível salvar as configurações." };
  }

  revalidatePath("/app", "layout");
  return { success: true };
}
