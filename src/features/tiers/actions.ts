"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { getTiers, type TierWithCount } from "@/features/tiers/queries";

export interface TierActionResult {
  ok: boolean;
  error?: string;
}

const ERRORS: Record<string, string> = {
  NOT_AUTHENTICATED: "Sessão expirada. Entre novamente.",
  FORBIDDEN: "Apenas owners e admins podem alterar categorias.",
  INVALID_NAME: "Informe o nome da categoria (até 60 caracteres).",
  INVALID_RATE: "A comissão deve estar entre 0% e 100%.",
  TIER_NAME_TAKEN: "Já existe uma categoria com esse nome.",
  TIER_NOT_FOUND: "Categoria não encontrada.",
  CREATOR_NOT_FOUND: "Creator não encontrada.",
};

function mapError(message: string | undefined): string {
  if (message) {
    for (const k of Object.keys(ERRORS)) if (message.includes(k)) return ERRORS[k];
  }
  return "Não foi possível salvar.";
}

async function requireAdmin() {
  const current = await getCurrentOrganization();
  if (!current) return { ok: false as const, error: "Organização não encontrada." };
  if (current.role === "analyst") return { ok: false as const, error: ERRORS.FORBIDDEN };
  return { ok: true as const, orgId: current.organization.id };
}

function revalidate() {
  revalidatePath("/app/settings/tiers");
  revalidatePath("/app/commissions");
  revalidatePath("/app/creators");
}

const tierSchema = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1, { error: ERRORS.INVALID_NAME }).max(60, { error: ERRORS.INVALID_NAME }),
  commissionRate: z
    .number({ error: ERRORS.INVALID_RATE })
    .min(0, { error: ERRORS.INVALID_RATE })
    .max(100, { error: ERRORS.INVALID_RATE }),
  description: z.string().trim().max(500, { error: "Descrição muito longa." }),
});

export async function saveTier(input: z.input<typeof tierSchema>): Promise<TierActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  const parsed = tierSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_creator_tier", {
    p_org: auth.orgId,
    p_id: parsed.data.id,
    p_name: parsed.data.name,
    p_commission_rate: parsed.data.commissionRate,
    p_description: parsed.data.description || null,
  });
  if (error) return { ok: false, error: mapError(error.message) };
  revalidate();
  return { ok: true };
}

export async function deleteTier(id: string): Promise<TierActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!z.uuid().safeParse(id).success) return { ok: false, error: ERRORS.TIER_NOT_FOUND };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_creator_tier", { p_org: auth.orgId, p_id: id });
  if (error) return { ok: false, error: mapError(error.message) };
  revalidate();
  return { ok: true };
}

/** null removes the creator from any tier. */
export async function setCreatorTier(creatorId: string, tierId: string | null): Promise<TierActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!z.uuid().safeParse(creatorId).success) return { ok: false, error: ERRORS.CREATOR_NOT_FOUND };
  if (tierId !== null && !z.uuid().safeParse(tierId).success) return { ok: false, error: ERRORS.TIER_NOT_FOUND };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_creator_tier", { p_creator_id: creatorId, p_tier_id: tierId });
  if (error) return { ok: false, error: mapError(error.message) };
  revalidate();
  return { ok: true };
}

/** For client components (the creator modal's tier picker). */
export async function loadTiers(): Promise<TierWithCount[]> {
  const current = await getCurrentOrganization();
  if (!current) return [];
  return getTiers(current.organization.id);
}
