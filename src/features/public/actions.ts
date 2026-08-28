"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { rateLimit, sweepRateLimits } from "@/lib/rate-limit";
import {
  buildFieldSchema,
  CONSENT_FIELD_KEY,
  HONEYPOT_FIELD_KEY,
  type PublicFieldDef,
} from "@/lib/form-fields";
import {
  normalizeEmail,
  normalizeHandle,
  normalizePhoneBR,
  socialProfileUrl,
} from "@/lib/normalize";
import { getPublicProgram } from "@/features/public/queries";
import type { Database, FieldMapping, Json } from "@/types/database";

export interface SubmitInput {
  orgSlug: string;
  programSlug: string;
  answers: Record<string, unknown>;
  utm: Partial<
    Record<"source" | "medium" | "campaign" | "content" | "term", string>
  >;
  referrer?: string;
}

export interface SubmitResult {
  ok: boolean;
  error?: string;
  possibleDuplicate?: boolean;
}

type SocialDraft = {
  platform: "instagram" | "tiktok";
  handle: string;
  handle_normalized: string;
  profile_url: string | null;
  followers_declared?: number | null;
};

function coarseSource(referrer: string | null): string | null {
  if (!referrer) return null;
  const r = referrer.toLowerCase();
  if (r.includes("instagram")) return "instagram";
  if (r.includes("tiktok")) return "tiktok";
  if (r.includes("youtube")) return "youtube";
  if (r.includes("google")) return "google";
  return null;
}

export async function submitApplication(
  input: SubmitInput,
): Promise<SubmitResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Formulário temporariamente indisponível." };
  }

  const requestHeaders = await headers();
  const ip =
    (requestHeaders.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip") ||
    "unknown";

  if (Math.random() < 0.05) sweepRateLimits();
  const limited = rateLimit(`submit:${ip}`);
  if (!limited.ok) {
    return {
      ok: false,
      error: "Muitas tentativas. Tente novamente em alguns minutos.",
    };
  }

  // Honeypot: a real user never fills this. Pretend success.
  if (String(input.answers[HONEYPOT_FIELD_KEY] ?? "").length > 0) {
    return { ok: true };
  }

  const data = await getPublicProgram(input.orgSlug, input.programSlug);
  if (!data) return { ok: false, error: "Formulário indisponível." };
  if (data.program.status !== "active") {
    return {
      ok: false,
      error: "As inscrições deste programa não estão abertas no momento.",
    };
  }

  const schema = buildFieldSchema(data.fields, { consent: true });
  const parsed = schema.safeParse(input.answers);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Revise os campos destacados e tente novamente.",
    };
  }
  const values = parsed.data;

  // ---- extract structured data -------------------------------------------
  const answersClean: Record<string, unknown> = {};
  const creator: Record<string, string | null> = {};
  const socials: Partial<Record<"instagram" | "tiktok", SocialDraft>> = {};
  const followers: Partial<Record<"instagram" | "tiktok", number>> = {};

  const ensureSocial = (
    platform: "instagram" | "tiktok",
    raw: unknown,
  ): void => {
    const normalized = normalizeHandle(raw, platform);
    if (!normalized) return;
    socials[platform] = {
      platform,
      handle: String(raw).trim(),
      handle_normalized: normalized,
      profile_url: socialProfileUrl(platform, normalized),
    };
  };

  const setCreator = (key: string, raw: unknown): void => {
    const s = typeof raw === "string" ? raw.trim() : "";
    if (s) creator[key] = s;
  };

  for (const field of data.fields as PublicFieldDef[]) {
    const value = values[field.field_key];
    answersClean[field.field_key] = value;
    const mapping: FieldMapping | undefined = field.configuration?.mapping;

    if (field.field_type === "instagram" || mapping === "instagram") {
      ensureSocial("instagram", value);
    } else if (field.field_type === "tiktok" || mapping === "tiktok") {
      ensureSocial("tiktok", value);
    } else if (mapping === "instagram_followers") {
      const n = Number(value);
      if (Number.isFinite(n)) followers.instagram = Math.trunc(n);
    } else if (mapping === "tiktok_followers") {
      const n = Number(value);
      if (Number.isFinite(n)) followers.tiktok = Math.trunc(n);
    } else if (mapping === "email") {
      creator.email = normalizeEmail(value);
    } else if (mapping === "phone") {
      creator.phone_e164 = normalizePhoneBR(value);
    } else if (mapping === "full_name") {
      setCreator("full_name", value);
    } else if (mapping === "preferred_name") {
      setCreator("preferred_name", value);
    } else if (mapping === "birth_date") {
      setCreator("birth_date", value);
    } else if (mapping === "city") {
      setCreator("city", value);
    } else if (mapping === "state") {
      setCreator("state", value);
    } else if (mapping === "postal_code") {
      setCreator("postal_code", value);
    }
  }

  for (const platform of ["instagram", "tiktok"] as const) {
    if (socials[platform] && followers[platform] != null) {
      socials[platform]!.followers_declared = followers[platform];
    }
  }

  const fieldSnapshot = (data.fields as PublicFieldDef[]).map((f) => ({
    field_key: f.field_key,
    label: f.label,
    field_type: f.field_type,
  }));

  delete answersClean[CONSENT_FIELD_KEY];
  delete answersClean[HONEYPOT_FIELD_KEY];

  const referrer =
    input.referrer?.slice(0, 500) || requestHeaders.get("referer") || null;

  // ---- atomic write via SECURITY DEFINER RPC ----------------------------
  // Every value below is JSON-serializable (Zod-parsed form data + our own
  // objects); the cast just satisfies the generated `Json` arg types.
  const rpcArgs: Database["public"]["Functions"]["submit_application"]["Args"] = {
    p_org_slug: input.orgSlug,
    p_program_slug: input.programSlug,
    p_form_version: data.program.form_version,
    p_answers: answersClean as Json,
    p_field_snapshot: fieldSnapshot as Json,
    p_creator: creator as Json,
    p_socials: Object.values(socials) as Json,
    p_utm: {
      source: input.utm.source ?? null,
      medium: input.utm.medium ?? null,
      campaign: input.utm.campaign ?? null,
      content: input.utm.content ?? null,
      term: input.utm.term ?? null,
    } as Json,
    p_referrer: referrer,
    p_source: coarseSource(referrer),
  };

  const supabase = await createClient();
  const { data: rpc, error } = await supabase.rpc("submit_application", rpcArgs);

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("PROGRAM_NOT_ACCEPTING")) {
      return {
        ok: false,
        error: "As inscrições deste programa não estão abertas no momento.",
      };
    }
    if (msg.includes("PROGRAM_NOT_FOUND")) {
      return { ok: false, error: "Formulário indisponível." };
    }
    if (msg.includes("MISSING_NAME")) {
      return { ok: false, error: "Informe seu nome completo." };
    }
    console.error("[submit_application] unexpected error", {
      code: error.code,
      message: error.message,
    });
    return {
      ok: false,
      error: "Não foi possível enviar sua candidatura. Tente novamente.",
    };
  }

  const result = (rpc ?? {}) as {
    possible_duplicate?: boolean;
    application_id?: string;
  };
  console.info("[submit_application] ok", {
    program: input.programSlug,
    application_id: result.application_id,
    possible_duplicate: result.possible_duplicate ?? false,
  });

  return { ok: true, possibleDuplicate: result.possible_duplicate ?? false };
}
