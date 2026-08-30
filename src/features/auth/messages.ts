/**
 * Auth flow constants shared by the pages, the server actions and the tests.
 * Plain module (no "use server") so it is importable anywhere.
 */
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";
export const LOGIN_PATH = "/login";

/**
 * Shown after a "recover password" submit, regardless of whether the e-mail
 * belongs to a real account. Never reveal account existence (enumeration).
 */
export const NEUTRAL_RESET_MESSAGE =
  "Se existir uma conta com este e-mail, enviaremos um link para redefinir sua senha.";

export const RECOVERY_LINK_INVALID_MESSAGE =
  "Este link de recuperação é inválido ou expirou. Solicite um novo e-mail.";
