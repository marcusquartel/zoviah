import { z } from "zod";

export const loginSchema = z.object({
  // Trim first, then validate the trimmed value.
  email: z.string().trim().pipe(z.email({ error: "Informe um e-mail válido." })),
  password: z.string().min(1, { error: "Informe a senha." }),
});

export type LoginInput = z.infer<typeof loginSchema>;
