import { z } from "zod";
// Relative (not "@/") so this schema stays importable by the node test runner.
import { BR_UFS } from "../br-locations.ts";
import { isValidCpf, stripCpf } from "./cpf.ts";

/**
 * Shared shipping-address schemas. Used by the signup form and the secure-link
 * form (client, for UX) and re-checked by their server actions. The
 * `submit_application` / `complete_address_request` RPCs normalize and
 * re-validate once more in SQL — this is never the only gate.
 *
 * pt-BR normalization: CEP → 8 digits, no mask; UF → 2 uppercase letters.
 */
const trimmed = (max: number, label: string) =>
  z
    .string()
    .trim()
    .min(1, { error: `Informe ${label}.` })
    .max(max, { error: `${label} muito longo.` });

/**
 * The shipping-address fields themselves (CPF included). The signup form
 * collects exactly these; the recipient is the creator's own name.
 */
export const addressFieldsSchema = z.object({
  cpf: z
    .string()
    .trim()
    .transform((v) => stripCpf(v))
    .refine((v) => isValidCpf(v), { error: "Informe um CPF válido." }),
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
});

export type AddressFieldsInput = z.infer<typeof addressFieldsSchema>;

/** The secure-link form: the address fields plus recipient and consent. */
export const addressSchema = addressFieldsSchema.extend({
  recipientName: trimmed(150, "o nome do destinatário"),
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

/** The `p_address` object `submit_application` expects (no recipient: SQL
 * uses the creator's name). */
export function toSignupAddressPayload(a: AddressFieldsInput) {
  return {
    cpf: a.cpf,
    postal_code: a.postalCode,
    street: a.street,
    number: a.number,
    complement: a.complement || null,
    neighborhood: a.neighborhood,
    city: a.city,
    state: a.state,
  };
}
