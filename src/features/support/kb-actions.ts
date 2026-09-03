"use server";

import {
  searchHelpArticles,
  type HelpArticleHit,
} from "@/features/support/queries";

/**
 * Client-callable full-text search over the published knowledge base, used by
 * the /app/ajuda page. Read-only; the RLS policy already limits it to
 * published articles.
 */
export async function searchKnowledgeBase(
  query: string,
): Promise<HelpArticleHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  return searchHelpArticles(q, 20);
}
