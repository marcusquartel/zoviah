import { createClient } from "@/lib/supabase/server";
import type { PortalCreatorRef, PortalDashboard } from "@/features/portal/types";

/** Creators the signed-in user can see in the portal (usually one). */
export async function getMyPortalCreators(): Promise<PortalCreatorRef[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_my_creators");
  if (error) return [];
  return (data ?? []) as unknown as PortalCreatorRef[];
}

export async function getPortalDashboard(creatorId: string): Promise<PortalDashboard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_dashboard", { p_creator_id: creatorId });
  if (error || !data) return null;
  return data as unknown as PortalDashboard;
}

/** Staff view of a creator's portal (owner/admin of her organization). */
export async function getPortalPreview(creatorId: string): Promise<PortalDashboard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("portal_dashboard_preview", { p_creator_id: creatorId });
  if (error || !data) return null;
  return data as unknown as PortalDashboard;
}

export interface PortalInviteView {
  status: "pending" | "accepted" | "invalid";
  organization_name?: string;
  creator_name?: string;
  email_masked?: string;
}

export async function getPortalInvite(tokenHash: string): Promise<PortalInviteView> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_creator_portal_invite", { p_token_hash: tokenHash });
  return ((data as unknown as PortalInviteView | null) ?? { status: "invalid" });
}
