"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { rateLimit } from "@/lib/rate-limit";
import { hashToken, isPlausibleToken } from "@/lib/secure-token";
import { addressSchema, toAddressPayload } from "@/lib/validation/address";

export interface CompleteAddressResult {
  ok: boolean;
  /** "completed" (first time or idempotent retry) or an error string. */
  status?: "completed";
  error?: string;
}

const RPC_ERRORS: Record<string, string> = {
  INVALID_LINK: "Este link não está mais disponível ou expirou.",
  CONSENT_REQUIRED: "É necessário confirmar o consentimento.",
  INVALID_ADDRESS: "Confira os dados do endereço e tente novamente.",
};

function mapError(message: string | undefined): string {
  if (message) {
    for (const key of Object.keys(RPC_ERRORS)) {
      if (message.includes(key)) return RPC_ERRORS[key];
    }
  }
  return "Não foi possível enviar seus dados. Tente novamente.";
}

export async function submitAddress(
  token: string,
  values: unknown,
  honeypot?: string,
): Promise<CompleteAddressResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Serviço temporariamente indisponível." };
  }
  // A real person never fills the honeypot — pretend success, do nothing.
  if (typeof honeypot === "string" && honeypot.trim().length > 0) {
    return { ok: true, status: "completed" };
  }
  if (!isPlausibleToken(token)) {
    return { ok: false, error: RPC_ERRORS.INVALID_LINK };
  }

  const requestHeaders = await headers();
  const ip =
    (requestHeaders.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown";
  const limited = rateLimit(`address:${ip}`, 10, 10 * 60 * 1000);
  if (!limited.ok) {
    return {
      ok: false,
      error: "Muitas tentativas. Tente novamente em alguns minutos.",
    };
  }

  const parsed = addressSchema.safeParse(values);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? RPC_ERRORS.INVALID_ADDRESS,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_address_request", {
    p_token_hash: hashToken(token),
    p_payload: toAddressPayload(parsed.data),
  });

  if (error) {
    // Never log the token or address; code + message only.
    console.error("[complete_address_request]", error.code, error.message);
    return { ok: false, error: mapError(error.message) };
  }

  const result = (data ?? {}) as { status?: string };
  if (result.status === "completed" || result.status === "already_completed") {
    return { ok: true, status: "completed" };
  }
  return { ok: false, error: mapError(undefined) };
}
