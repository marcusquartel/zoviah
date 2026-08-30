import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import {
  deriveOnboardingState,
  type OnboardingState,
} from "@/features/onboarding/state";

/** Derives every checklist step from real tenant state (§26). */
export async function getOnboardingState(): Promise<OnboardingState | null> {
  const current = await getCurrentOrganization();
  if (!current) return null;
  const orgId = current.organization.id;
  const supabase = await createClient();

  const [programs, activePrograms, members, invites, applications] =
    await Promise.all([
      supabase
        .from("programs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId),
      supabase
        .from("programs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "active"),
      supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId),
      supabase
        .from("organization_invites")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId),
      supabase
        .from("applications")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId),
    ]);

  const s = current.settings;
  return deriveOnboardingState({
    hasBrand: Boolean(s?.primary_color || s?.logo_url),
    hasProgram: (programs.count ?? 0) > 0,
    hasPublishedProgram: (activePrograms.count ?? 0) > 0,
    teamInvited: (members.count ?? 0) > 1 || (invites.count ?? 0) > 0,
    hasApplication: (applications.count ?? 0) > 0,
  });
}
