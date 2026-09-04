"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { hashToken } from "@/lib/secure-token";
import { rateLimit, sweepRateLimits } from "@/lib/rate-limit";
import { buildFieldSchema, HONEYPOT_FIELD_KEY } from "@/lib/form-fields";
import { buildApplicationPayload } from "@/lib/application-payload";
import { mapSubmitApplicationError } from "@/lib/submit-application-errors";
import { getPublicProgram } from "@/features/public/queries";
import type { Database, Json } from "@/types/database";

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

  // Layer 1: cheap per-instance limiter (blunts a burst hitting one worker).
  if (Math.random() < 0.05) sweepRateLimits();
  const limited = rateLimit(`submit:${ip}`);
  if (!limited.ok) {
    return {
      ok: false,
      error: "Muitas tentativas. Tente novamente em alguns minutos.",
    };
  }

  // Layer 2: durable DB-backed limiter — survives serverless instance churn.
  // The raw IP never reaches the database; only its sha256 hash.
  if (ip !== "unknown") {
    const supabaseRl = await createClient();
    const { data: rl } = await supabaseRl.rpc("rate_limit_public_submission", {
      p_ip_hash: hashToken(ip),
      p_max: 8,
      p_window_secs: 600,
    });
    if (rl && (rl as { allowed?: boolean }).allowed === false) {
      return {
        ok: false,
        error: "Muitas tentativas. Tente novamente em alguns minutos.",
      };
    }
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

  const { answersClean, creator, socials, fieldSnapshot } =
    buildApplicationPayload(data.fields, parsed.data);

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
    p_socials: socials as Json,
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
    const mapped = mapSubmitApplicationError(error.message);
    if (!mapped) {
      console.error("[submit_application] unexpected error", {
        code: error.code,
        message: error.message,
      });
    }
    return {
      ok: false,
      error: mapped ?? "Não foi possível enviar sua candidatura. Tente novamente.",
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
