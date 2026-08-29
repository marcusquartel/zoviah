import { z } from "zod";
// Relative (not "@/") so this schema stays importable by the node test runner.
import { normalizeCpf } from "../cpf.ts";
import { BR_UFS } from "../br-locations.ts";

/**
 * Shared shipping-address schema (Phase 4 §82). Used by the public form
 * (client, for UX) and re-checked by the completion server action. The
 * `complete_address_request` RPC normalizes and re-validates once more in SQL —
 * this is never the only gate.
 *
 * pt-BR normalization: CEP → 8 digits, no mask; UF → 2 uppercase letters.
 */
const trimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, { error: `Informe ${label}.` })
    .max(max, { error: `${label} muito longo.` });

export const addressSchema = z.object({
  recipientName: trimmed(150, "o nome do destinatário"),
  cpf: z
    .string()
    .trim()
    .transform((v) => normalizeCpf(v) ?? v.replace(/\D/g, ""))
    .refine((v) => normalizeCpf(v) !== null, { error: "CPF inválido." }),
  postalCode: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D/g, ""))
    .refine((v) => v.length === 8, { error: "CEP deve ter 8 dígitos." }),
  street: trimmed(200, "a rua"),
  number: trimmed(50, "o número"),
  complement: z
    .string()
    .trim()
    .max(150, { error: "Complemento muito longo." })
    .optional()
    .default(""),
  neighborhood: trimmed(150, "o bairro"),
  city: trimmed(150, "a cidade"),
  state: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase())
    .refine((v) => (BR_UFS as readonly string[]).includes(v), {
      error: "Selecione o estado.",
    }),
  consent: z.literal(true, {
    error: "É necessário confirmar o consentimento.",
  }),
});

export type AddressInput = z.infer<typeof addressSchema>;

/** The plain object the completion RPC expects as `p_payload`. */
export function toAddressPayload(a: AddressInput) {
  return {
    recipient_name: a.recipientName,
    cpf: a.cpf,
    postal_code: a.postalCode,
    street: a.street,
    number: a.number,
    complement: a.complement || null,
    neighborhood: a.neighborhood,
    city: a.city,
    state: a.state,
    consent: a.consent === true,
  };
}
