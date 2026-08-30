"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { buildAuthCallbackUrl } from "@/lib/app-url";
import {
  forgotPasswordSchema,
  loginSchema,
  passwordResetSchema,
} from "@/lib/validation/auth";
import { RESET_PASSWORD_PATH } from "@/features/auth/messages";

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
  ok?: boolean;
  error?: string;
}

/**
 * Sets the new password for the recovery session established by
 * `/auth/callback`. On success the recovery session is discarded so the user
 * signs in fresh with the new password. Never touches membership/org.
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
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      error:
        "Sessão de recuperação ausente ou expirada. Solicite um novo e-mail.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("same") || msg.includes("different from the old")) {
      return { error: "A nova senha deve ser diferente da anterior." };
    }
    if (msg.includes("weak") || msg.includes("password")) {
      return { error: "Senha muito fraca. Escolha uma senha mais forte." };
    }
    console.error("[updatePassword] failed:", error.status);
    return { error: "Não foi possível alterar a senha. Tente novamente." };
  }

  // Fresh login with the new password — clears the recovery session.
  await supabase.auth.signOut();
  return { ok: true };
}
