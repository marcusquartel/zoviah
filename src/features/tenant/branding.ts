import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getHostContext } from "@/lib/tenant/context";

export interface TenantBranding {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

/**
 * White-label branding for the tenant in the current `Host`, resolved without
 * an authenticated session (the login page needs it). Returns `null` on the
 * root domain, an unknown subdomain, or a suspended org. `cache()`d per request.
 *
 * `getCurrentOrganization()` stays the source of truth once the user is signed
 * in; this is only for pre-auth pages on a `<subdomain>.zoviah.app` host.
 */
export const getTenantBrandingFromHost = cache(
  async (): Promise<TenantBranding | null> => {
    if (!isSupabaseConfigured()) return null;
    const host = await getHostContext();
    if (host.kind !== "tenant") return null;

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_org_branding", {
      p_subdomain: host.subdomain,
    });
    if (error || !data) return null;

    const row = data as {
      name?: string;
      logo_url?: string | null;
      primary_color?: string | null;
      secondary_color?: string | null;
    };
    if (!row.name) return null;
    return {
      name: row.name,
      logoUrl: row.logo_url ?? null,
      primaryColor: row.primary_color ?? null,
      secondaryColor: row.secondary_color ?? null,
    };
  },
);
