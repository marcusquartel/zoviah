"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { normalizeEmail, normalizeHandle, normalizePhoneBR, parseCount } from "@/lib/normalize";
import {
  addressFieldsSchema,
  toSignupAddressPayload,
  type AddressFieldsInput,
} from "@/lib/validation/address";
import type { Json } from "@/types/database";
import type { ActionResult } from "@/features/creators/actions";

const EDIT_ERRORS: Record<string, string> = {
  NOT_AUTHENTICATED: "Sessão expirada. Entre novamente.",
  FORBIDDEN: "Apenas administradores podem editar creators.",
  CREATOR_NOT_FOUND: "Creator não encontrada.",
  INVALID_NAME: "Informe o nome completo.",
  INVALID_EMAIL: "E-mail inválido.",
  EMAIL_TAKEN: "Já existe outra creator com este e-mail.",
  INVALID_PHONE: "Telefone inválido. Use DDD + número.",
  INVALID_BIRTH_DATE: "Data de nascimento inválida.",
  HANDLE_TAKEN: "Este @ já pertence a outra creator.",
  INVALID_ADDRESS: "Revise o endereço e o CPF.",
  INVALID_PAYLOAD: "Revise os dados informados.",
};

function mapEditError(message: string | undefined): string {
  if (message) {
    for (const key of Object.keys(EDIT_ERRORS)) {
      if (message.includes(key)) return EDIT_ERRORS[key];
    }
  }
  return "Não foi possível salvar.";
}

async function requireEditor(): Promise<string | null> {
  const current = await getCurrentOrganization();
  if (!current) return "Organização não encontrada.";
  if (current.role === "analyst") return EDIT_ERRORS.FORBIDDEN;
  return null;
}

const optionalText = (max: number) =>
  z.string().trim().max(max, { error: "Texto muito longo." });

const profileSchema = z.object({
  creatorId: z.uuid(),
  fullName: z
    .string()
    .trim()
    .min(1, { error: "Informe o nome completo." })
    .max(150, { error: "Nome muito longo." }),
  preferredName: optionalText(120),
  email: optionalText(254),
  phone: optionalText(40),
  birthDate: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      error: "Data de nascimento inválida.",
    }),
  city: optionalText(120),
  state: optionalText(2),
  postalCode: optionalText(9),
  instagram: optionalText(200),
  instagramFollowers: optionalText(20),
  tiktok: optionalText(200),
  tiktokFollowers: optionalText(20),
});

export type CreatorProfileInput = z.input<typeof profileSchema>;

/** Cadastro + Redes, saved together through `update_creator_profile`. */
export async function updateCreatorProfile(
  input: CreatorProfileInput,
): Promise<ActionResult> {
  const denied = await requireEditor();
  if (denied) return { ok: false, error: denied };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const v = parsed.data;

  const email = v.email ? normalizeEmail(v.email) : null;
  if (v.email && !email) return { ok: false, error: EDIT_ERRORS.INVALID_EMAIL };

  const phone = v.phone ? normalizePhoneBR(v.phone) : null;
  if (v.phone && !phone) return { ok: false, error: EDIT_ERRORS.INVALID_PHONE };

  const postal = v.postalCode.replace(/\D/g, "");
  if (postal && postal.length !== 8) {
    return { ok: false, error: "CEP deve ter 8 dígitos." };
  }

  const social = (raw: string, followers: string, platform: "instagram" | "tiktok") => {
    const handle = normalizeHandle(raw, platform);
    const count = followers ? parseCount(followers) : null;
    return {
      handle: handle ? `@${handle}` : "",
      handle_normalized: handle ?? "",
      followers: count != null ? String(count) : "",
    };
  };

  const payload = {
    full_name: v.fullName,
    preferred_name: v.preferredName,
    email: email ?? "",
    phone_e164: phone ?? "",
    birth_date: v.birthDate,
    city: v.city,
    state: v.state.toUpperCase(),
    postal_code: postal,
    socials: {
      instagram: social(v.instagram, v.instagramFollowers, "instagram"),
      tiktok: social(v.tiktok, v.tiktokFollowers, "tiktok"),
    },
  };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_creator_profile", {
    p_creator_id: v.creatorId,
    p_payload: payload as Json,
  });
  if (error) {
    const known = Object.keys(EDIT_ERRORS).some((k) => error.message.includes(k));
    if (!known) console.error("[update_creator_profile]", error.code, error.message);
    return { ok: false, error: mapEditError(error.message) };
  }

  revalidatePath("/app/creators");
  return { ok: true };
}

/** Staff-entered shipping address (CPF included) → the creator's current one. */
export async function setCreatorAddressManual(input: {
  creatorId: string;
  address: AddressFieldsInput;
}): Promise<ActionResult> {
  const denied = await requireEditor();
  if (denied) return { ok: false, error: denied };

  const id = z.uuid().safeParse(input.creatorId);
  const address = addressFieldsSchema.safeParse(input.address);
  if (!id.success) return { ok: false, error: EDIT_ERRORS.CREATOR_NOT_FOUND };
  if (!address.success) {
    return {
      ok: false,
      error: address.error.issues[0]?.message ?? EDIT_ERRORS.INVALID_ADDRESS,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_creator_address_manual", {
    p_creator_id: id.data,
    p_payload: toSignupAddressPayload(address.data) as Json,
  });
  if (error) {
    const known = Object.keys(EDIT_ERRORS).some((k) => error.message.includes(k));
    if (!known) console.error("[set_creator_address_manual]", error.code, error.message);
    return { ok: false, error: mapEditError(error.message) };
  }

  revalidatePath("/app/creators");
  return { ok: true };
}
