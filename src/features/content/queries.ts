import { createClient } from "@/lib/supabase/server";
import type { ContentFormat, ContentPlatform, ContentStatus, CreatorContent } from "@/types/database";

export interface ContentItem {
  id: string;
  platform: ContentPlatform;
  format: ContentFormat;
  url: string | null;
  screenshot_path: string | null;
  posted_on: string;
  note: string | null;
  status: ContentStatus;
  review_note: string | null;
  /** Short-lived signed URL of the private screenshot. */
  screenshot_url?: string | null;
}

export interface PortalContent {
  month: { approved: number; pending: number; stories: number; feed: number };
  total_approved: number;
  items: ContentItem[];
}

type Db = Awaited<ReturnType<typeof createClient>>;

/** Attach signed URLs (1h) to items with a screenshot. */
export async function withScreenshotUrls<T extends { screenshot_path: string | null }>(
  supabase: Db,
  items: T[],
): Promise<(T & { screenshot_url: string | null })[]> {
  const paths = items.map((i) => i.screenshot_path).filter((p): p is string => Boolean(p));
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("creator-content").createSignedUrls(paths, 3600);
    for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl);
  }
  return items.map((i) => ({ ...i, screenshot_url: i.screenshot_path ? (urls.get(i.screenshot_path) ?? null) : null }));
}

/** The creator's own content (portal) — also used by the staff preview. */
export async function getPortalContent(creatorId: string): Promise<PortalContent | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_content", { p_creator_id: creatorId });
  if (error || !data) return null;
  const content = data as unknown as PortalContent;
  return { ...content, items: await withScreenshotUrls(supabase, content.items) };
}

export interface StaffContentRow extends CreatorContent {
  creator_name: string;
  screenshot_url: string | null;
}

/** Staff list for the org (RLS-scoped), newest first. */
export async function listOrgContent(
  orgId: string,
  opts: { status?: ContentStatus | null; creatorId?: string | null; from?: string | null; limit?: number } = {},
): Promise<StaffContentRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("creator_content")
    .select("*")
    .eq("organization_id", orgId)
    .order("posted_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 200);
  if (opts.status) q = q.eq("status", opts.status);
  if (opts.creatorId) q = q.eq("creator_id", opts.creatorId);
  if (opts.from) q = q.gte("posted_on", opts.from);
  const { data } = await q;
  const rows = (data ?? []) as CreatorContent[];
  const ids = [...new Set(rows.map((r) => r.creator_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data: cs } = await supabase
      .from("creators")
      .select("id, full_name, preferred_name")
      .eq("organization_id", orgId)
      .in("id", ids);
    for (const c of cs ?? []) names.set(c.id, c.preferred_name || c.full_name);
  }
  const withUrls = await withScreenshotUrls(supabase, rows);
  return withUrls.map((r) => ({ ...r, creator_name: names.get(r.creator_id) ?? "Creator removida" }));
}

export interface MonthSummaryRow {
  creator_id: string;
  creator_name: string;
  post: number;
  reel: number;
  story: number;
  video: number;
  total: number;
}

/** Approved content per creator since `from` (YYYY-MM-DD). */
export async function getMonthSummary(orgId: string, from: string): Promise<MonthSummaryRow[]> {
  const rows = await listOrgContent(orgId, { status: "approved", from, limit: 5000 });
  const by = new Map<string, MonthSummaryRow>();
  for (const r of rows) {
    const s = by.get(r.creator_id) ?? {
      creator_id: r.creator_id,
      creator_name: r.creator_name,
      post: 0,
      reel: 0,
      story: 0,
      video: 0,
      total: 0,
    };
    s[r.format] += 1;
    s.total += 1;
    by.set(r.creator_id, s);
  }
  return [...by.values()].sort((a, b) => b.total - a.total || a.creator_name.localeCompare(b.creator_name));
}
