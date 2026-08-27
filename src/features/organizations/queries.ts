import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type {
  Organization,
  OrganizationRole,
  OrganizationSettings,
} from "@/types/database";

export interface CurrentOrganization {
  organization: Organization;
  settings: OrganizationSettings | null;
  role: OrganizationRole;
}

/**
 * The authenticated user, verified against the Supabase Auth server.
 * `cache()` dedupes the call within a single request/render.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

/**
 * The organization the current user belongs to.
 *
 * MVP rule: a user is expected to belong to exactly one organization, so we
 * take the earliest membership. When multi-org support lands, this is where an
 * "active organization" selector would resolve. The value is never trusted as
 * an authorization decision — RLS re-checks membership on every query, so the
 * worst a tampered client can do is pick an org it is already a member of.
 *
 * One round-trip: the membership row with the organization and its settings
 * embedded through the foreign keys.
 */
export const getCurrentOrganization = cache(
  async (): Promise<CurrentOrganization | null> => {
    if (!isSupabaseConfigured()) return null;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("organization_members")
      .select(
        `role,
         organizations (
           id, name, slug, status, created_at, updated_at,
           organization_settings (
             organization_id, logo_url, favicon_url,
             primary_color, secondary_color, created_at, updated_at
           )
         )`,
      )
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data?.organizations) return null;

    const { organization_settings, ...organization } = data.organizations;

    return {
      organization,
      settings: organization_settings ?? null,
      role: data.role,
    };
  },
);
