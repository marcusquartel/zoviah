import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentOrganization } from "@/features/organizations/queries";
import type {
  AddressRequestStatus,
  CreatorAddress,
} from "@/types/database";

/** One row of the request history — NEVER includes the token hash (§48). */
export interface AddressRequestSummary {
  id: string;
  status: AddressRequestStatus;
  created_at: string;
  expires_at: string;
  completed_at: string | null;
  revoked_at: string | null;
  created_by_email: string | null;
}

export interface AddressTabData {
  requests: AddressRequestSummary[];
  currentAddress: CreatorAddress | null;
}

/**
 * Everything the "Endereço" tab needs. Loaded on demand (§100) — the CRM list
 * never touches these tables (§99).
 */
export async function getAddressTabData(
  applicationId: string,
  creatorId: string,
): Promise<AddressTabData> {
  const current = await getCurrentOrganization();
  if (!current) return { requests: [], currentAddress: null };
  const supabase = await createClient();
  const orgId = current.organization.id;

  const [{ data: reqs }, { data: addr }, { data: events }] = await Promise.all([
    supabase
      .from("application_requests")
      .select(
        "id, status, created_at, expires_at, completed_at, revoked_at, created_by",
      )
      .eq("organization_id", orgId)
      .eq("application_id", applicationId)
      .eq("request_type", "shipping_address")
      .order("created_at", { ascending: false }),
    supabase
      .from("creator_addresses")
      .select("*")
      .eq("organization_id", orgId)
      .eq("creator_id", creatorId)
      .eq("is_current", true)
      .maybeSingle(),
    supabase
      .from("creator_events")
      .select("type, data")
      .eq("organization_id", orgId)
      .eq("application_id", applicationId)
      .in("type", ["address_request_created", "address_request_regenerated"]),
  ]);

  // "Criada por" comes from the audit event the RPC wrote (auth.users is not
  // readable via RLS). Key: request_id -> actor_email.
  const emailByRequest = new Map<string, string>();
  for (const e of events ?? []) {
    const d = (e.data ?? {}) as Record<string, unknown>;
    if (typeof d.request_id === "string" && typeof d.actor_email === "string") {
      emailByRequest.set(d.request_id, d.actor_email);
    }
  }

  const requests: AddressRequestSummary[] = (reqs ?? []).map((r) => ({
    id: r.id,
    status: r.status,
    created_at: r.created_at,
    expires_at: r.expires_at,
    completed_at: r.completed_at,
    revoked_at: r.revoked_at,
    created_by_email: emailByRequest.get(r.id) ?? null,
  }));

  return { requests, currentAddress: addr ?? null };
}

// ---------------------------------------------------------------------------
// Public lookup — the ONLY thing the /complete/[token] page may read.
// ---------------------------------------------------------------------------
export interface PublicAddressBranding {
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
}

export type PublicAddressRequest =
  | { status: "invalid" }
  | { status: "completed"; organization: PublicAddressBranding }
  | {
      status: "pending";
      organization: PublicAddressBranding;
      program_name: string | null;
      expires_at: string;
    };

export const getPublicAddressRequest = cache(
  async (tokenHash: string): Promise<PublicAddressRequest> => {
    if (!isSupabaseConfigured()) return { status: "invalid" };
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_address_request", {
      p_token_hash: tokenHash,
    });
    if (error || !data) return { status: "invalid" };
    return data as unknown as PublicAddressRequest;
  },
);
