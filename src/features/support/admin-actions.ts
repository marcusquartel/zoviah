"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getIsPlatformAdmin } from "@/features/platform/queries";
import { getSupportTicket } from "@/features/support/admin-queries";
import { buildEngineeringPrompt } from "@/features/support/engineering-prompt";
import { HELP_CATEGORIES } from "@/features/support/labels";

export interface AdminSupportResult {
  ok: boolean;
  error?: string;
}

function mapError(message: string | undefined): string {
  if (message?.includes("FORBIDDEN")) return "Ação restrita a operadores da plataforma.";
  if (message?.includes("NOT_FOUND")) return "Registro não encontrado.";
  if (message?.includes("INVALID")) return "Dados inválidos.";
  return "Não foi possível concluir a ação.";
}

const updateTicketSchema = z.object({
  ticketId: z.uuid(),
  status: z.enum(["open", "in_progress", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "normal", "high", "critical"]).optional(),
  assignSelf: z.boolean().optional(),
  adminNotes: z.string().trim().max(8000).optional(),
});

export async function updateSupportTicket(input: {
  ticketId: string;
  status?: string;
  priority?: string;
  assignSelf?: boolean;
  adminNotes?: string;
}): Promise<AdminSupportResult> {
  if (!(await getIsPlatformAdmin())) {
    return { ok: false, error: "Ação restrita a operadores da plataforma." };
  }
  const parsed = updateTicketSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_support_ticket", {
    p_ticket_id: parsed.data.ticketId,
    p_status: parsed.data.status ?? null,
    p_priority: parsed.data.priority ?? null,
    p_assign_self: parsed.data.assignSelf ?? null,
    p_admin_notes: parsed.data.adminNotes ?? null,
  });
  if (error) return { ok: false, error: mapError(error.message) };
  revalidatePath("/admin/support");
  return { ok: true };
}

const articleSchema = z.object({
  id: z.uuid().nullable(),
  category: z.enum(HELP_CATEGORIES as unknown as [string, ...string[]]),
  title: z.string().trim().min(3).max(200),
  slug: z
    .string()
    .trim()
    .transform((v) => v.toLowerCase())
    .refine((v) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v), { error: "Slug inválido." }),
  summary: z.string().trim().max(500).optional().nullable(),
  content: z.string().trim().min(10),
  keywords: z.array(z.string().trim().min(1).max(40)).max(20),
  status: z.enum(["draft", "published", "archived"]),
});

export async function upsertHelpArticle(input: {
  id: string | null;
  category: string;
  title: string;
  slug: string;
  summary?: string | null;
  content: string;
  keywords: string[];
  status: string;
}): Promise<AdminSupportResult & { id?: string }> {
  if (!(await getIsPlatformAdmin())) {
    return { ok: false, error: "Ação restrita a operadores da plataforma." };
  }
  const parsed = articleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_upsert_help_article", {
    p_id: parsed.data.id,
    p_category: parsed.data.category,
    p_title: parsed.data.title,
    p_slug: parsed.data.slug,
    p_summary: parsed.data.summary ?? null,
    p_content: parsed.data.content,
    p_keywords: parsed.data.keywords,
    p_status: parsed.data.status,
  });
  if (error) return { ok: false, error: mapError(error.message) };
  revalidatePath("/admin/support/knowledge");
  return { ok: true, id: (data as { id?: string })?.id };
}

/**
 * §23 — build the engineering prompt for a ticket and return it as TEXT.
 * It is not sent anywhere and Claude Code is not invoked. The operator copies
 * it manually. §24 — the builder scrubs PII from the free-text fields.
 */
export async function prepareEngineeringPrompt(
  ticketId: string,
): Promise<{ ok: boolean; prompt?: string; error?: string }> {
  if (!(await getIsPlatformAdmin())) {
    return { ok: false, error: "Ação restrita a operadores da plataforma." };
  }
  if (!z.uuid().safeParse(ticketId).success) {
    return { ok: false, error: "Ticket inválido." };
  }
  const ticket = await getSupportTicket(ticketId);
  if (!ticket) return { ok: false, error: "Ticket não encontrado." };

  const prompt = buildEngineeringPrompt({
    ticketId: ticket.id,
    type: ticket.type,
    subject: ticket.subject,
    description: ticket.description,
    module: ticket.module,
    currentRoute: ticket.current_route,
    conversation: ticket.conversation ?? undefined,
    articleTitles: ticket.article_titles,
  });
  return { ok: true, prompt };
}
