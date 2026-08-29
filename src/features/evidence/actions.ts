"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { parseViews } from "@/features/evidence/parse-views";
import {
  metricSnapshotSchema,
  type MetricSnapshotInput,
} from "@/lib/validation/metrics";

export interface SnapshotActionResult {
  ok: boolean;
  error?: string;
  /** Friendly per-field notes for the form (not RLS/SQL detail, §76). */
  fieldError?: string;
}

/** Raw form payload — every numeric field arrives as a string from the Dialog. */
export interface SnapshotFormInput {
  socialProfileId: string;
  source: string;
  observedAt: string;
  periodDays?: string;
  followers?: string;
  /** Free text pasted by the admin; parsed server-side (§10, §11). */
  viewsText?: string;
  averageViews?: string;
  medianViews?: string;
  averageLikes?: string;
  averageComments?: string;
  averageShares?: string;
  averageSaves?: string;
  reach?: string;
  interactions?: string;
  postsCount?: string;
  notes?: string;
}

const RPC_ERRORS: Record<string, string> = {
  NOT_AUTHENTICATED: "Sessão expirada. Entre novamente.",
  FORBIDDEN: "Você não tem permissão para editar as métricas desta creator.",
  PROFILE_NOT_FOUND: "Perfil social não encontrado.",
  SNAPSHOT_NOT_FOUND: "Registro de métricas não encontrado.",
  OBSERVED_AT_FUTURE: "A data da observação não pode ser no futuro.",
  SAMPLE_TOO_LARGE: "A amostra de views aceita no máximo 30 conteúdos.",
};

function mapRpcError(message: string | undefined): string {
  if (message) {
    for (const key of Object.keys(RPC_ERRORS)) {
      if (message.includes(key)) return RPC_ERRORS[key];
    }
  }
  return "Não foi possível salvar as métricas.";
}

/**
 * Server-authoritative shape for the RPC. The parser and Zod schema run here —
 * never trust a client-computed median/average (§11). `views_sample` is the
 * only view input persisted; the RPC recomputes median/average from it in SQL.
 */
function toRpcPayload(v: MetricSnapshotInput) {
  return {
    source: v.source,
    observed_at: v.observedAt,
    period_days: v.periodDays,
    followers: v.followers,
    views_sample: v.viewsSample,
    // Only used as a fallback when no sample was pasted.
    average_views: v.averageViews,
    median_views: v.medianViews,
    average_likes: v.averageLikes,
    average_comments: v.averageComments,
    average_shares: v.averageShares,
    average_saves: v.averageSaves,
    reach: v.reach,
    interactions: v.interactions,
    posts_count: v.postsCount,
    notes: v.notes.length > 0 ? v.notes : null,
  };
}

function validate(
  raw: SnapshotFormInput,
): { ok: true; data: MetricSnapshotInput } | { ok: false; error: string } {
  const parsedViews = parseViews(raw.viewsText ?? "");
  const result = metricSnapshotSchema.safeParse({
    socialProfileId: raw.socialProfileId,
    source: raw.source,
    observedAt: raw.observedAt,
    periodDays: raw.periodDays ?? "",
    followers: raw.followers ?? "",
    viewsSample: parsedViews.values,
    averageViews: raw.averageViews ?? "",
    medianViews: raw.medianViews ?? "",
    averageLikes: raw.averageLikes ?? "",
    averageComments: raw.averageComments ?? "",
    averageShares: raw.averageShares ?? "",
    averageSaves: raw.averageSaves ?? "",
    reach: raw.reach ?? "",
    interactions: raw.interactions ?? "",
    postsCount: raw.postsCount ?? "",
    notes: raw.notes ?? "",
  });
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues[0]?.message ?? "Confira os valores informados.",
    };
  }
  return { ok: true, data: result.data };
}

export async function createMetricSnapshot(
  raw: SnapshotFormInput,
): Promise<SnapshotActionResult> {
  const parsed = validate(raw);
  if (!parsed.ok) return { ok: false, fieldError: parsed.error };

  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_metric_snapshot", {
    p_social_profile_id: parsed.data.socialProfileId,
    p_payload: toRpcPayload(parsed.data) as never,
  });

  if (error) {
    console.error("[create_metric_snapshot]", error.code, error.message);
    return { ok: false, error: mapRpcError(error.message) };
  }

  revalidatePath("/app/creators");
  revalidatePath("/app/ai");
  return { ok: true };
}

export async function updateMetricSnapshot(
  snapshotId: string,
  raw: SnapshotFormInput,
): Promise<SnapshotActionResult> {
  const parsed = validate(raw);
  if (!parsed.ok) return { ok: false, fieldError: parsed.error };

  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_metric_snapshot", {
    p_snapshot_id: snapshotId,
    p_payload: toRpcPayload(parsed.data) as never,
  });

  if (error) {
    console.error("[update_metric_snapshot]", error.code, error.message);
    return { ok: false, error: mapRpcError(error.message) };
  }

  revalidatePath("/app/creators");
  revalidatePath("/app/ai");
  return { ok: true };
}
