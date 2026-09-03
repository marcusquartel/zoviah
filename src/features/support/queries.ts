import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentOrganization } from "@/features/organizations/queries";
import type {
  SupportTicket,
  SupportConversation,
  SupportMessage,
} from "@/types/database";

export interface HelpArticleHit {
  id: string;
  category: string;
  title: string;
  slug: string;
  summary: string | null;
  content: string;
}

/** Full-text search over PUBLISHED articles. Empty query → most-recent list. */
export async function searchHelpArticles(
  query: string,
  limit = 8,
): Promise<HelpArticleHit[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_help_articles", {
    p_query: query ?? "",
    p_limit: limit,
  });
  if (error || !Array.isArray(data)) return [];
  return data as unknown as HelpArticleHit[];
}

export interface HelpArticleSummary {
  id: string;
  category: string;
  title: string;
  slug: string;
  summary: string | null;
}

/** Every published article (no body) for the browse-by-category view. */
export const getAllHelpArticles = cache(
  async (): Promise<HelpArticleSummary[]> => {
    if (!isSupabaseConfigured()) return [];
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("help_articles")
      .select("id, category, title, slug, summary")
      .eq("status", "published")
      .order("category", { ascending: true })
      .order("title", { ascending: true });
    if (error || !Array.isArray(data)) return [];
    return data as HelpArticleSummary[];
  },
);

export interface HelpArticleFull extends HelpArticleSummary {
  content: string;
  updated_at: string;
}

/** One published article by slug, with its body. `null` when not found. */
export async function getHelpArticle(
  slug: string,
): Promise<HelpArticleFull | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("help_articles")
    .select("id, category, title, slug, summary, content, updated_at")
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as HelpArticleFull;
}

export const getMyTickets = cache(async (): Promise<SupportTicket[]> => {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data;
});

export async function getConversation(
  id: string,
): Promise<{ conversation: SupportConversation; messages: SupportMessage[] } | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data: conversation, error } = await supabase
    .from("support_conversations")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !conversation) return null;
  const { data: messages } = await supabase
    .from("support_messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  return { conversation, messages: messages ?? [] };
}

/** The org id for the current tenant user, or null. */
export async function getCurrentOrgId(): Promise<string | null> {
  const current = await getCurrentOrganization();
  return current?.organization.id ?? null;
}
