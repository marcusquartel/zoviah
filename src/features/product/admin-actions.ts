"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getIsPlatformAdmin } from "@/features/platform/queries";

export interface AdminProductResult {
  ok: boolean;
  error?: string;
  id?: string;
}

function mapError(message: string | undefined): string {
  if (message?.includes("FORBIDDEN")) return "Ação restrita a operadores da plataforma.";
  if (message?.includes("NOT_FOUND")) return "Registro não encontrado.";
  if (message?.includes("INVALID")) return "Dados inválidos.";
  return "Não foi possível concluir a ação.";
}

async function guard(): Promise<string | null> {
  if (!(await getIsPlatformAdmin())) {
    return "Ação restrita a operadores da plataforma.";
  }
  return null;
}

const updateFRSchema = z.object({
  requestId: z.uuid(),
  status: z
    .enum(["submitted", "under_review", "planned", "in_progress", "released", "declined"])
    .optional(),
  canonicalRequestId: z.uuid().nullable().optional(),
  adminNote: z.string().trim().max(4000).optional(),
  clearCanonical: z.boolean().optional(),
});

export async function updateFeatureRequest(input: {
  requestId: string;
  status?: string;
  canonicalRequestId?: string | null;
  adminNote?: string;
  clearCanonical?: boolean;
}): Promise<AdminProductResult> {
  const err = await guard();
  if (err) return { ok: false, error: err };
  const parsed = updateFRSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_feature_request", {
    p_request_id: parsed.data.requestId,
    p_status: parsed.data.status ?? null,
    p_canonical_request_id: parsed.data.canonicalRequestId ?? null,
    p_admin_note: parsed.data.adminNote ?? null,
    p_clear_canonical: parsed.data.clearCanonical ?? false,
  });
  if (error) return { ok: false, error: mapError(error.message) };
  revalidatePath("/admin/product");
  return { ok: true };
}

const roadmapSchema = z.object({
  id: z.uuid().nullable(),
  title: z.string().trim().min(3).max(160),
  summary: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(["under_consideration", "planned", "in_progress", "released"]),
  sortOrder: z.number().int().min(0).max(9999),
  featureRequestId: z.uuid().nullable().optional(),
  published: z.boolean(),
});

export async function upsertRoadmapItem(input: {
  id: string | null;
  title: string;
  summary?: string | null;
  status: string;
  sortOrder: number;
  featureRequestId?: string | null;
  published: boolean;
}): Promise<AdminProductResult> {
  const err = await guard();
  if (err) return { ok: false, error: err };
  const parsed = roadmapSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_upsert_roadmap_item", {
    p_id: parsed.data.id,
    p_title: parsed.data.title,
    p_summary: parsed.data.summary ?? null,
    p_status: parsed.data.status,
    p_sort_order: parsed.data.sortOrder,
    p_feature_request_id: parsed.data.featureRequestId ?? null,
    p_published: parsed.data.published,
  });
  if (error) return { ok: false, error: mapError(error.message) };
  revalidatePath("/admin/product");
  revalidatePath("/app/roadmap");
  return { ok: true, id: (data as { id?: string })?.id };
}

const changelogSchema = z.object({
  id: z.uuid().nullable(),
  title: z.string().trim().min(3).max(200),
  summary: z.string().trim().max(1000).optional().nullable(),
  content: z.string().trim().min(10),
  status: z.enum(["draft", "published"]),
  relatedRoadmapItemId: z.uuid().nullable().optional(),
});

export async function upsertChangelogEntry(input: {
  id: string | null;
  title: string;
  summary?: string | null;
  content: string;
  status: string;
  relatedRoadmapItemId?: string | null;
}): Promise<AdminProductResult> {
  const err = await guard();
  if (err) return { ok: false, error: err };
  const parsed = changelogSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_upsert_changelog_entry", {
    p_id: parsed.data.id,
    p_title: parsed.data.title,
    p_summary: parsed.data.summary ?? null,
    p_content: parsed.data.content,
    p_status: parsed.data.status,
    p_related_roadmap_item_id: parsed.data.relatedRoadmapItemId ?? null,
  });
  if (error) return { ok: false, error: mapError(error.message) };
  revalidatePath("/admin/product");
  revalidatePath("/app/changelog");
  return { ok: true, id: (data as { id?: string })?.id };
}
