import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getHostContext } from "@/lib/tenant/context";
import type {
  Organization,
  OrganizationRole,
  OrganizationSettings,
} from "@/types/database";

export interface CurrentOrganization {
  organization: Organization;
  settings: OrganizationSettings | null;
  role: OrganizationRole;
  /** The tenant slug taken from the host, when the request came in on one. */
  fromHostSlug?: string;
}

const ORG_SELECT = `role,
   organizations!inner (
     id, name, slug, status, created_at, updated_at,
     organization_settings (
       organization_id, logo_url, favicon_url,
       primary_color, secondary_color, created_at, updated_at
     )
   )`;

function shape(data: {
  role: OrganizationRole;
  organizations: Organization & {
    organization_settings: OrganizationSettings | null;
  };
}): CurrentOrganization {
  const { organization_settings, ...organization } = data.organizations;
  return {
    organization,
    settings: organization_settings ?? null,
    role: data.role,
  };
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
 * The organization context for the current request.
 *
 * - On a tenant subdomain (`<slug>.zoviah.app`), the org is the one whose
 *   `slug` matches the host — AND ONLY IF the current user is a member of it
 *   (the query goes through `organization_members`, so a non-member gets
 *   `null`, never a fallback to some other org). The host selects context; it
 *   never grants access. RLS is still the last barrier.
 * - On the root domain, a user is expected to belong to exactly one org, so we
 *   take the earliest membership (unchanged behaviour).
 *
 * One round-trip in both cases, filtered by the indexed `organizations.slug`
 * on the tenant path. `cache()` dedupes it across a render.
 */
export const getCurrentOrganization = cache(
  async (): Promise<CurrentOrganization | null> => {
    if (!isSupabaseConfigured()) return null;
    const supabase = await createClient();
    const host = await getHostContext();

    if (host.kind === "tenant") {
      const { data, error } = await supabase
        .from("organization_members")
        .select(ORG_SELECT)
        .eq("organizations.slug", host.slug)
        .limit(1)
        .maybeSingle();
      if (error || !data?.organizations) return null;
      return { ...shape(data), fromHostSlug: host.slug };
    }

    const { data, error } = await supabase
      .from("organization_members")
      .select(ORG_SELECT)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error || !data?.organizations) return null;
    return shape(data);
  },
);
