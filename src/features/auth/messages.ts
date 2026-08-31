/**
 * Auth flow constants shared by the pages, the server actions and the tests.
 * Plain module (no "use server") so it is importable anywhere.
 */
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";
/** Prefetch-safe confirmation page — a GET here NEVER consumes the OTP. */
export const RECOVER_CONFIRM_PATH = "/recover/confirm";
export const LOGIN_PATH = "/login";

/** `/login?password_reset=success` — set after a successful password reset. */
export const PASSWORD_RESET_SUCCESS_PARAM = "password_reset";
export const PASSWORD_RESET_SUCCESS_VALUE = "success";
export const PASSWORD_RESET_SUCCESS_PATH = `${LOGIN_PATH}?${PASSWORD_RESET_SUCCESS_PARAM}=${PASSWORD_RESET_SUCCESS_VALUE}`;
export const PASSWORD_RESET_SUCCESS_MESSAGE =
  "Senha alterada com sucesso. Entre com sua nova senha.";

/**
 * Shown after a "recover password" submit, regardless of whether the e-mail
 * belongs to a real account. Never reveal account existence (enumeration).
 */
export const NEUTRAL_RESET_MESSAGE =
  "Se existir uma conta com este e-mail, enviaremos um link para redefinir sua senha.";

export const RECOVERY_LINK_INVALID_MESSAGE =
  "Este link de recuperação é inválido ou expirou. Solicite um novo e-mail.";

/**
 * Safe, coarse error codes for the recovery flow. They surface WHICH step
 * failed (in the URL `?error=` and in server logs) without ever exposing the
 * token, the e-mail, or Supabase's raw message.
 */
export const RECOVERY_ERRORS = {
  missingToken: "recovery_missing_token",
  invalidType: "recovery_invalid_type",
  otpExpired: "recovery_otp_expired",
  verifyFailed: "recovery_verify_failed",
  cookieFailed: "recovery_cookie_failed",
} as const;

export type RecoveryErrorCode =
  (typeof RECOVERY_ERRORS)[keyof typeof RECOVERY_ERRORS];

/** User-facing copy per code — generic, no Supabase text, no PII. */
export const RECOVERY_ERROR_MESSAGES: Record<RecoveryErrorCode, string> = {
  recovery_missing_token:
    "Link de recuperação incompleto. Solicite um novo e-mail.",
  recovery_invalid_type: RECOVERY_LINK_INVALID_MESSAGE,
  recovery_otp_expired:
    "Este link de recuperação expirou ou já foi usado. Solicite um novo e-mail.",
  recovery_verify_failed: RECOVERY_LINK_INVALID_MESSAGE,
  recovery_cookie_failed:
    "Não foi possível iniciar a sessão de recuperação. Tente novamente.",
};

export function recoveryErrorMessage(code: string | null | undefined): string {
  if (code && code in RECOVERY_ERROR_MESSAGES) {
    return RECOVERY_ERROR_MESSAGES[code as RecoveryErrorCode];
  }
  return RECOVERY_LINK_INVALID_MESSAGE;
}
