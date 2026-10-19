"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { generateSecureToken, hashToken } from "@/lib/secure-token";
import { buildSecureLinkUrl } from "@/lib/app-url";

export interface AddressLinkResult {
  ok: boolean;
  /** The raw secure URL — shown to the admin ONCE, never persisted. */
  url?: string;
  expiresAt?: string;
  error?: string;
}

export interface AddressActionResult {
  ok: boolean;
  error?: string;
}

const idSchema = z.uuid();

const RPC_ERRORS: Record<string, string> = {
  NOT_AUTHENTICATED: "Sessão expirada. Entre novamente.",
  FORBIDDEN: "Você não tem acesso a esta inscrição.",
  APPLICATION_NOT_FOUND: "Inscrição não encontrada.",
  APPLICATION_ARCHIVED:
    "Esta inscrição está arquivada. Reabra-a para solicitar o endereço.",
  REQUEST_ALREADY_PENDING:
    "Já existe uma solicitação pendente — use \"Gerar novo link\".",
  NO_ACTIVE_REQUEST: "Não há solicitação de endereço ativa.",
};

function mapError(message: string | undefined): string {
  if (message) {
    for (const key of Object.keys(RPC_ERRORS)) {
      if (message.includes(key)) return RPC_ERRORS[key];
    }
  }
  return "Não foi possível concluir a ação.";
}

async function mintLink(
  rpc: "create_address_request" | "regenerate_address_request",
  applicationId: string,
): Promise<AddressLinkResult> {
  const parsed = idSchema.safeParse(applicationId);
  if (!parsed.success) return { ok: false, error: "Inscrição inválida." };

  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };

  // Raw token lives only in this function's scope + the returned URL.
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(rpc, {
    p_application_id: parsed.data,
    p_token_hash: tokenHash,
  });

  if (error) {
    console.error(`[${rpc}]`, error.code, error.message);
    return { ok: false, error: mapError(error.message) };
  }

  const result = (data ?? {}) as { expires_at?: string };
  revalidatePath("/app/creators");
  revalidatePath("/app");
  return {
    ok: true,
    url: buildSecureLinkUrl(rawToken),
    expiresAt: result.expires_at,
  };
}

/** Generate a secure address link. Never changes the application status. */
export async function createAddressRequest(
  applicationId: string,
): Promise<AddressLinkResult> {
  return mintLink("create_address_request", applicationId);
}

/** Revoke the pending token and issue a new one. */
export async function regenerateAddressRequest(
  applicationId: string,
): Promise<AddressLinkResult> {
  return mintLink("regenerate_address_request", applicationId);
}

/** Revoke the pending request. */
export async function revokeAddressRequest(
  applicationId: string,
): Promise<AddressActionResult> {
  const parsed = idSchema.safeParse(applicationId);
  if (!parsed.success) return { ok: false, error: "Inscrição inválida." };

  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_address_request", {
    p_application_id: parsed.data,
  });
  if (error) {
    console.error("[revoke_address_request]", error.code, error.message);
    return { ok: false, error: mapError(error.message) };
  }
  revalidatePath("/app/creators");
  revalidatePath("/app");
  return { ok: true };
}
