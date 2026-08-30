import { z } from "zod";

const emailField = z
  .string()
  .trim()
  .pipe(z.email({ error: "Informe um e-mail válido." }));

export const loginSchema = z.object({
  // Trim first, then validate the trimmed value.
  email: emailField,
  password: z.string().min(1, { error: "Informe a senha." }),
});

export type LoginInput = z.infer<typeof loginSchema>;

/** "Esqueci minha senha" — just an e-mail. */
export const forgotPasswordSchema = z.object({ email: emailField });

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * New-password form. Supabase Auth hashes and stores the password; this only
 * enforces a sane minimum and the confirmation match. Bcrypt caps the input at
 * 72 bytes, so anything longer is rejected here rather than silently truncated.
 */
export const passwordResetSchema = z
  .object({
    password: z
      .string()
      .min(8, { error: "A senha deve ter ao menos 8 caracteres." })
      .max(72, { error: "A senha deve ter no máximo 72 caracteres." }),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    error: "As senhas não coincidem.",
    path: ["confirm"],
  });

export type PasswordResetInput = z.infer<typeof passwordResetSchema>;
