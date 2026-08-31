"use server";

import { redirect } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { buildAuthCallbackUrl } from "@/lib/app-url";
import {
  forgotPasswordSchema,
  loginSchema,
  passwordResetSchema,
} from "@/lib/validation/auth";
import {
  PASSWORD_RESET_SUCCESS_PATH,
  RECOVERY_ERRORS,
  RESET_PASSWORD_PATH,
} from "@/features/auth/messages";
import {
  classifyVerifyError,
  isAllowedOtpType,
  mapUpdatePasswordError,
  safeNextPath,
} from "@/features/auth/callback";

export interface LoginState {
  error?: string;
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase não configurado. Veja o README." };
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: "E-mail ou senha incorretos." };
  }

  // Only same-origin relative paths are honoured as a post-login destination.
  const rawNext = String(formData.get("next") ?? "");
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/app";
  redirect(next);
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Consumes the recovery OTP — POST only, triggered by an explicit button on
 * /recover/confirm. Never called on a GET, so an e-mail scanner that pre-opens
 * the link cannot burn the single-use token.
 *
 * `verifyOtp` runs server-to-server; the @supabase/ssr server client writes
 * the session cookie (this is a Server Action, cookie writes commit). We then
 * re-check `getUser()` to be sure the cookie actually stuck before sending the
 * user to the reset form. The token_hash is never logged.
 */
export async function confirmRecovery(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) {
    redirect(`${RESET_PASSWORD_PATH}?error=${RECOVERY_ERRORS.verifyFailed}`);
  }

  const tokenHash = String(formData.get("token_hash") ?? "");
  const type = String(formData.get("type") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? RESET_PASSWORD_PATH));

  const fail = (code: string): never => {
    console.error("[recovery] verify failed", {
      code,
      flow: "recovery",
      at: new Date().toISOString(),
    });
    redirect(`${RESET_PASSWORD_PATH}?error=${code}`);
  };

  if (!tokenHash) fail(RECOVERY_ERRORS.missingToken);
  if (!isAllowedOtpType(type)) fail(RECOVERY_ERRORS.invalidType);

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    type: type as EmailOtpType,
    token_hash: tokenHash,
  });
  if (error) {
    console.error("[recovery] verifyOtp error", {
      status: error.status ?? null,
      code: error.code ?? null,
      flow: "recovery",
      at: new Date().toISOString(),
    });
    fail(classifyVerifyError(error));
  }

  // Confirm the session cookie actually persisted.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) fail(RECOVERY_ERRORS.cookieFailed);

  redirect(next);
}

// ---------------------------------------------------------------------------
// Password recovery (Supabase Auth is the source of truth — no custom table).
// ---------------------------------------------------------------------------

export interface ForgotPasswordState {
  /** Always the same neutral message once a submit was processed. */
  sent?: boolean;
  error?: string;
}

/**
 * "Esqueci minha senha". Sends the Supabase recovery e-mail. The response is
 * ALWAYS the neutral "if an account exists…" message — a bad e-mail format is
 * the only thing that gets a distinct error. We never disclose whether the
 * address belongs to a real account, and never log the address or any token.
 */
export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  if (!isSupabaseConfigured()) {
    return { error: "Recuperação de senha indisponível no momento." };
  }
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "E-mail inválido." };
  }

  try {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: buildAuthCallbackUrl(RESET_PASSWORD_PATH),
    });
  } catch {
    // Swallow: surfacing an error here would leak timing / existence signals.
    console.error("[requestPasswordReset] unexpected failure");
  }
  return { sent: true };
}

export interface ResetPasswordState {
  error?: string;
  /** The recovery session was gone before the update — offer a fresh link. */
  expired?: boolean;
}

/**
 * Sets the new password for the recovery session established by
 * `/recover/confirm`. On success it signs the recovery session out and
 * `redirect()`s to `/login?password_reset=success` — so this route never
 * re-renders in its signed-out ("invalid link") state after a successful
 * change. Never touches membership/org. Never returns on success.
 */
export async function updatePassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  if (!isSupabaseConfigured()) {
    return { error: "Serviço indisponível no momento." };
  }
  const parsed = passwordResetSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Senha inválida." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      expired: true,
      error:
        "Sessão de recuperação ausente ou expirada. Solicite um novo e-mail.",
    };
  }

  // No try/catch here: we inspect the returned `error`, and the success path
  // ends in redirect() — which throws NEXT_REDIRECT and MUST NOT be caught,
  // or /reset-password re-renders (now signed out) as an "invalid link".
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  const mapped = mapUpdatePasswordError(error);
  if (mapped) {
    console.error("[updatePassword] failed", {
      status: error?.status ?? null,
      flow: "recovery",
      at: new Date().toISOString(),
    });
    return { error: mapped };
  }

  // Password changed. End the recovery session, then navigate away so this
  // route never re-renders without a session.
  await supabase.auth.signOut();
  redirect(PASSWORD_RESET_SUCCESS_PATH);
}
