import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { OrganizationRole, OrgInviteStatus } from "@/types/database";

export interface TeamMember {
  user_id: string;
  email: string | null;
  role: OrganizationRole;
  created_at: string;
}

export interface TeamInvite {
  id: string;
  email: string;
  role: OrganizationRole;
  status: OrgInviteStatus;
  expires_at: string;
  created_at: string;
}

export interface TeamData {
  members: TeamMember[];
  invites: TeamInvite[];
}

export async function getTeam(organizationId: string): Promise<TeamData> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_org_members", {
    p_organization_id: organizationId,
  });
  if (error || !data) return { members: [], invites: [] };
  const d = data as unknown as TeamData;
  return { members: d.members ?? [], invites: d.invites ?? [] };
}

export type PublicInvite =
  | { status: "invalid" }
  | {
      status: "pending" | "accepted";
      organization_name: string;
      role: OrganizationRole;
      email_masked: string;
    };

export const getPublicInvite = cache(
  async (tokenHash: string): Promise<PublicInvite> => {
    if (!isSupabaseConfigured()) return { status: "invalid" };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_org_invite", {
      p_token_hash: tokenHash,
    });
    if (error || !data) return { status: "invalid" };
    return data as unknown as PublicInvite;
  },
);
