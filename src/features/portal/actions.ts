"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { generateSecureToken, hashToken } from "@/lib/secure-token";
import { buildAuthCallbackUrl, buildPortalInviteUrl } from "@/lib/app-url";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { sendEmail } from "@/lib/notifications/resend";
import { buildPortalInviteEmail } from "@/lib/notifications/portal-invite-email";

export interface PortalActionResult {
  ok: boolean;
  error?: string;
  message?: string;
  /** Invite link, so staff can also send it by WhatsApp. */
  url?: string;
}

const ERRORS: Record<string, string> = {
  NOT_AUTHENTICATED: "Sessão expirada. Entre novamente.",
  FORBIDDEN: "Apenas owners e admins podem gerenciar o portal.",
  CREATOR_NOT_FOUND: "Creator não encontrada.",
  CREATOR_WITHOUT_EMAIL: "Cadastre o e-mail da creator antes de convidar.",
  INVALID_INVITE: "Este convite não está mais disponível. Peça um novo à marca.",
  EMAIL_MISMATCH: "Este convite é para outro e-mail. Entre com o e-mail que recebeu o convite.",
};

function mapError(message: string | undefined, fallback: string): string {
  if (message) {
    for (const k of Object.keys(ERRORS)) if (message.includes(k)) return ERRORS[k];
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Staff
// ---------------------------------------------------------------------------

/** Create (or re-create) the creator's portal invite and e-mail it. */
export async function inviteCreatorToPortal(creatorId: string): Promise<PortalActionResult> {
  if (!z.uuid().safeParse(creatorId).success) return { ok: false, error: ERRORS.CREATOR_NOT_FOUND };
  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };
  if (current.role === "analyst") return { ok: false, error: ERRORS.FORBIDDEN };

  const token = generateSecureToken();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_creator_portal_invite", {
    p_creator_id: creatorId,
    p_token_hash: hashToken(token),
  });
  if (error) return { ok: false, error: mapError(error.message, "Não foi possível criar o convite.") };

  const invite = data as unknown as { email: string; creator_name: string; organization_name: string };
  const url = buildPortalInviteUrl(token);
  const mail = buildPortalInviteEmail({
    creatorName: invite.creator_name,
    organizationName: invite.organization_name,
    url,
  });
  const failure = await sendEmail({ brandName: invite.organization_name, to: invite.email, ...mail });

  revalidatePath("/app/creators");
  if (failure) {
    console.error("[portal invite] e-mail failed", failure);
    return {
      ok: true,
      url,
      message: "Convite criado, mas o e-mail não foi enviado. Copie o link e envie para ela.",
    };
  }
  return { ok: true, url, message: `Convite enviado para ${invite.email}.` };
}

export async function revokeCreatorPortal(creatorId: string): Promise<PortalActionResult> {
  if (!z.uuid().safeParse(creatorId).success) return { ok: false, error: ERRORS.CREATOR_NOT_FOUND };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_creator_portal_access", { p_creator_id: creatorId });
  if (error) return { ok: false, error: mapError(error.message, "Não foi possível remover o acesso.") };
  revalidatePath("/app/creators");
  return { ok: true, message: "Acesso ao portal removido." };
}

// ---------------------------------------------------------------------------
// Creator (invite page / login)
// ---------------------------------------------------------------------------

export interface PortalSignupResult {
  ok: boolean;
  error?: string;
  needsEmailConfirmation?: boolean;
  accountExists?: boolean;
  accepted?: boolean;
}

const SIGNUP_REASONS: Record<string, string> = {
  invalid: "Este convite não está mais disponível.",
  expired: "Este convite expirou. Peça um novo à marca.",
  revoked: "Este convite foi cancelado.",
  accepted: "Este convite já foi usado. Entre com seu e-mail e senha.",
};

/**
 * Account creation from a valid portal invite. The e-mail comes from the
 * invite (server-side), never from the browser — same as the team invite.
 */
export async function signUpForPortal(input: {
  token: string;
  password: string;
}): Promise<PortalSignupResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Cadastro temporariamente indisponível." };
  const token = String(input.token ?? "");
  const password = String(input.password ?? "");
  if (password.length < 8 || password.length > 72) {
    return { ok: false, error: "A senha deve ter entre 8 e 72 caracteres." };
  }

  const supabase = await createClient();
  const { data: prep, error: prepErr } = await supabase.rpc("prepare_creator_portal_signup", {
    p_token_hash: hashToken(token),
  });
  if (prepErr) return { ok: false, error: "Não foi possível validar o convite." };
  const prepared = prep as unknown as { ok: true; email: string } | { ok: false; reason: string };
  if (!prepared.ok) return { ok: false, error: SIGNUP_REASONS[prepared.reason] ?? SIGNUP_REASONS.invalid };

  const { data: signUp, error: signErr } = await supabase.auth.signUp({
    email: prepared.email,
    password,
    // PKCE: the confirmation link must land on the callback that exchanges
    // the code (see the team-invite fix).
    options: { emailRedirectTo: buildAuthCallbackUrl(`/portal/convite/${token}`) },
  });
  if (signErr) {
    const msg = signErr.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("already been registered")) {
      return { ok: false, accountExists: true, error: "Você já tem uma conta com este e-mail. Entre para ativar o portal." };
    }
    if (msg.includes("weak") || msg.includes("password")) {
      return { ok: false, error: "Senha muito fraca. Use uma senha mais forte." };
    }
    console.error("[portal signUp]", signErr.status, signErr.message);
    return { ok: false, error: "Não foi possível criar a conta." };
  }
  if (signUp.user && signUp.user.identities?.length === 0) {
    return { ok: false, accountExists: true, error: "Você já tem uma conta com este e-mail. Entre para ativar o portal." };
  }
  if (!signUp.session) return { ok: true, needsEmailConfirmation: true };

  const { error: accErr } = await supabase.rpc("accept_creator_portal_invite", {
    p_token_hash: hashToken(token),
  });
  if (accErr) {
    console.error("[accept portal invite after signup]", accErr.code, accErr.message);
    return { ok: true, accepted: false };
  }
  return { ok: true, accepted: true };
}

export async function acceptPortalInvite(token: string): Promise<PortalActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_creator_portal_invite", {
    p_token_hash: hashToken(String(token ?? "")),
  });
  if (error) return { ok: false, error: mapError(error.message, "Não foi possível ativar o portal.") };
  return { ok: true };
}

export async function portalLogout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/portal/login");
}

/** Save (or clear, with null) the creator's photo URL. Creator or org admin. */
export async function setCreatorAvatar(creatorId: string, url: string | null): Promise<PortalActionResult> {
  if (!z.uuid().safeParse(creatorId).success) return { ok: false, error: ERRORS.CREATOR_NOT_FOUND };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_creator_avatar", { p_creator_id: creatorId, p_url: url ?? "" });
  if (error) return { ok: false, error: mapError(error.message, "Não foi possível salvar a foto.") };
  revalidatePath("/portal");
  revalidatePath("/app/creators");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// First access (no invite)
// ---------------------------------------------------------------------------

export interface PortalFirstAccessResult {
  ok: boolean;
  error?: string;
  accountExists?: boolean;
}

const firstAccessSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(8).max(72),
});

/**
 * Creates the account for an approved creator's first access. The answer is
 * the same whether or not the e-mail belongs to a creator (no enumeration):
 * the portal link happens only after she confirms the e-mail, and only for
 * creators with that e-mail on an approved record (portal_my_creators).
 */
export async function startPortalAccess(input: { email: string; password: string }): Promise<PortalFirstAccessResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Serviço indisponível." };
  const parsed = firstAccessSchema.safeParse({
    email: String(input.email ?? "").trim().toLowerCase(),
    password: String(input.password ?? ""),
  });
  if (!parsed.success) return { ok: false, error: "Informe um e-mail válido e uma senha de 8 caracteres ou mais." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: buildAuthCallbackUrl("/portal") },
  });
  const exists = "Você já tem uma conta com este e-mail. Entre com sua senha ou use \"Esqueci minha senha\".";
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("already been registered")) {
      return { ok: false, accountExists: true, error: exists };
    }
    if (msg.includes("weak") || msg.includes("password")) {
      return { ok: false, error: "Senha muito fraca. Use uma senha mais forte." };
    }
    if (msg.includes("rate") || error.status === 429) {
      return { ok: false, error: "Muitas tentativas. Aguarde alguns minutos." };
    }
    console.error("[portal first access]", error.status, error.message);
    return { ok: false, error: "Não foi possível criar o acesso." };
  }
  if (data.user && data.user.identities?.length === 0) return { ok: false, accountExists: true, error: exists };
  return { ok: true };
}
