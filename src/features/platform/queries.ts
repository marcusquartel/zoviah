import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { OrganizationStatus, PlanCode } from "@/types/database";

/** Whether the current user is a Creator Hub platform operator. */
export const getIsPlatformAdmin = cache(async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("is_platform_admin");
  return !error && data === true;
});

export interface AdminOrgRow {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  created_at: string;
  plan_code: PlanCode | null;
  users_count: number;
  creators_count: number;
  programs_count: number;
  shipments_count: number;
}

const PAGE_SIZE = 50;

export async function listOrganizations(
  search: string,
  page: number,
): Promise<{ items: AdminOrgRow[]; hasMore: boolean; page: number }> {
  const supabase = await createClient();
  const p = Math.max(1, page);
  const { data, error } = await supabase.rpc("admin_list_organizations", {
    p_search: search.trim() || undefined,
    p_limit: PAGE_SIZE + 1,
    p_offset: (p - 1) * PAGE_SIZE,
  });
  if (error || !Array.isArray(data)) {
    return { items: [], hasMore: false, page: p };
  }
  const rows = data as unknown as AdminOrgRow[];
  return { items: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE, page: p };
}

export interface AdminOrgDetail {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  created_at: string;
  plan_code: PlanCode | null;
  started_at: string | null;
  expires_at: string | null;
  notes: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  users_count: number;
  creators_count: number;
  programs_count: number;
  applications_count: number;
  analyses_count: number;
  shipments_count: number;
  pending_invites: number;
}

export const getOrganizationDetail = cache(
  async (id: string): Promise<AdminOrgDetail | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_get_organization", {
      p_organization_id: id,
    });
    if (error || !data) return null;
    return data as unknown as AdminOrgDetail;
  },
);

export interface PlatformAuditRow {
  id: string;
  event_type: string;
  organization_id: string | null;
  organization_name: string | null;
  actor_email: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export async function listPlatformAudit(
  page: number,
): Promise<{ items: PlatformAuditRow[]; hasMore: boolean; page: number }> {
  const supabase = await createClient();
  const p = Math.max(1, page);
  const { data, error } = await supabase.rpc("admin_list_platform_audit", {
    p_limit: PAGE_SIZE + 1,
    p_offset: (p - 1) * PAGE_SIZE,
  });
  if (error || !Array.isArray(data)) return { items: [], hasMore: false, page: p };
  const rows = data as unknown as PlatformAuditRow[];
  return { items: rows.slice(0, PAGE_SIZE), hasMore: rows.length > PAGE_SIZE, page: p };
}
