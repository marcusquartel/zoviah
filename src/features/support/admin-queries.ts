import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  HelpArticle,
  SupportTicketPriority,
  SupportTicketStatus,
  SupportTicketType,
} from "@/types/database";

export interface SupportOverview {
  conversations: number;
  ai_resolved: number;
  escalated: number;
  tickets_open: number;
  tickets_critical: number;
  ai_resolution_rate: number | null;
}

export const getSupportOverview = cache(
  async (): Promise<SupportOverview | null> => {
    if (!isSupabaseConfigured()) return null;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_support_overview");
    if (error || !data) return null;
    return data as unknown as SupportOverview;
  },
);

export interface AdminTicketRow {
  id: string;
  type: SupportTicketType;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  subject: string;
  module: string | null;
  created_at: string;
  updated_at: string;
  organization_name: string;
  assigned_email: string | null;
}

export async function listSupportTickets(filters: {
  status?: string;
  priority?: string;
  type?: string;
}): Promise<AdminTicketRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_support_tickets", {
    p_status: filters.status || null,
    p_priority: filters.priority || null,
    p_type: filters.type || null,
    p_limit: 100,
    p_offset: 0,
  });
  if (error || !Array.isArray(data)) return [];
  return data as unknown as AdminTicketRow[];
}

export interface AdminTicketDetail {
  id: string;
  type: SupportTicketType;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  subject: string;
  description: string;
  current_route: string | null;
  module: string | null;
  classification: Record<string, unknown>;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  organization_id: string;
  organization_name: string;
  organization_plan: string | null;
  reporter_email: string | null;
  assigned_email: string | null;
  conversation:
    | { role: string; content: string; article_refs: string[]; created_at: string }[]
    | null;
  article_titles: string[];
}

export const getSupportTicket = cache(
  async (id: string): Promise<AdminTicketDetail | null> => {
    if (!isSupabaseConfigured()) return null;
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("admin_get_support_ticket", {
      p_ticket_id: id,
    });
    if (error || !data) return null;
    return data as unknown as AdminTicketDetail;
  },
);

export async function listHelpArticles(status?: string): Promise<HelpArticle[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_help_articles", {
    p_status: status || null,
  });
  if (error || !Array.isArray(data)) return [];
  return data as unknown as HelpArticle[];
}
