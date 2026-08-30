"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { generateSecureToken, hashToken } from "@/lib/secure-token";
import { buildInviteUrl } from "@/lib/app-url";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { OrganizationRole } from "@/types/database";

export interface TeamActionResult {
  ok: boolean;
  error?: string;
}

export interface InviteResult extends TeamActionResult {
  url?: string;
}

const RPC_ERRORS: Record<string, string> = {
  FORBIDDEN: "Você não tem permissão para gerenciar a equipe.",
  NOT_AUTHENTICATED: "Sessão expirada. Entre novamente.",
  INVALID_EMAIL: "E-mail inválido.",
  INVALID_ROLE: "Papel inválido.",
  ALREADY_MEMBER: "Esta pessoa já faz parte da equipe.",
  MEMBER_NOT_FOUND: "Membro não encontrado.",
  INVITE_NOT_FOUND: "Convite não encontrado.",
  LAST_OWNER: "A organização precisa de ao menos um owner.",
  INVALID_INVITE: "Este convite não está mais disponível ou expirou.",
  EMAIL_MISMATCH: "Este convite é para outro e-mail. Entre com a conta correta.",
  ORGANIZATION_SUSPENDED: "Organização suspensa. Fale com o suporte.",
};

function mapError(message: string | undefined): string {
  if (message) {
    for (const key of Object.keys(RPC_ERRORS)) {
      if (message.includes(key)) return RPC_ERRORS[key];
    }
  }
  return "Não foi possível concluir a ação.";
}

const roleSchema = z.enum(["owner", "admin", "analyst"] as [
  OrganizationRole,
  OrganizationRole,
  OrganizationRole,
]);

export async function inviteMember(input: {
  email: string;
  role: string;
}): Promise<InviteResult> {
  const email = z.email().safeParse(input.email.trim().toLowerCase());
  const role = roleSchema.safeParse(input.role);
  if (!email.success) return { ok: false, error: "E-mail inválido." };
  if (!role.success) return { ok: false, error: "Papel inválido." };

  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };
  if (current.role === "analyst") {
    return { ok: false, error: RPC_ERRORS.FORBIDDEN };
  }

  const rawToken = generateSecureToken();
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_org_invite", {
    p_organization_id: current.organization.id,
    p_email: email.data,
    p_role: role.data,
    p_token_hash: hashToken(rawToken),
  });
  if (error) {
    console.error("[create_org_invite]", error.code, error.message);
    return { ok: false, error: mapError(error.message) };
  }
  revalidatePath("/app/settings/team");
  return { ok: true, url: buildInviteUrl(rawToken) };
}

export async function revokeInvite(
  inviteId: string,
): Promise<TeamActionResult> {
  const id = z.uuid().safeParse(inviteId);
  if (!id.success) return { ok: false, error: "Convite inválido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_org_invite", {
    p_invite_id: id.data,
  });
  if (error) {
    console.error("[revoke_org_invite]", error.code, error.message);
    return { ok: false, error: mapError(error.message) };
  }
  revalidatePath("/app/settings/team");
  return { ok: true };
}

export async function removeMember(userId: string): Promise<TeamActionResult> {
  const id = z.uuid().safeParse(userId);
  if (!id.success) return { ok: false, error: "Membro inválido." };
  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_org_member", {
    p_organization_id: current.organization.id,
    p_user_id: id.data,
  });
  if (error) {
    console.error("[remove_org_member]", error.code, error.message);
    return { ok: false, error: mapError(error.message) };
  }
  revalidatePath("/app/settings/team");
  return { ok: true };
}

export async function changeMemberRole(input: {
  userId: string;
  role: string;
}): Promise<TeamActionResult> {
  const id = z.uuid().safeParse(input.userId);
  const role = roleSchema.safeParse(input.role);
  if (!id.success || !role.success) return { ok: false, error: "Dados inválidos." };
  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_org_member_role", {
    p_organization_id: current.organization.id,
    p_user_id: id.data,
    p_role: role.data,
  });
  if (error) {
    console.error("[set_org_member_role]", error.code, error.message);
    return { ok: false, error: mapError(error.message) };
  }
  revalidatePath("/app/settings/team");
  return { ok: true };
}

export interface AcceptInviteResult {
  ok: boolean;
  error?: string;
  status?: "accepted" | "already_member";
}

export async function acceptInvite(
  rawToken: string,
): Promise<AcceptInviteResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_org_invite", {
    p_token_hash: hashToken(rawToken),
  });
  if (error) {
    console.error("[accept_org_invite]", error.code, error.message);
    return { ok: false, error: mapError(error.message) };
  }
  const result = data as { status?: "accepted" | "already_member" };
  revalidatePath("/app", "layout");
  return { ok: true, status: result.status };
}

// ---------------------------------------------------------------------------
// Invite-only signup (Phase 7A).
//
// A brand-new person can create their own account straight from the invite
// page — no operator "Add user" in the Supabase dashboard. There is NO public
// signup: an account is only created when a still-valid invite token is
// presented, and the e-mail is taken from the server-validated invite, never
// from the browser.
// ---------------------------------------------------------------------------

export interface SignupFromInviteResult {
  ok: boolean;
  error?: string;
  /** True when Supabase Auth requires the user to confirm their e-mail first. */
  needsEmailConfirmation?: boolean;
  /** Set when the account existed already — the UI should switch to login. */
  accountExists?: boolean;
  /** Set when the invite was accepted in the same call (confirmation off). */
  accepted?: boolean;
}

const SIGNUP_REASONS: Record<string, string> = {
  invalid: "Este convite não está mais disponível.",
  expired: "Este convite expirou. Peça um novo à equipe.",
  revoked: "Este convite foi cancelado.",
  accepted: "Este convite já foi aceito. Faça login.",
  organization_suspended: "A organização está suspensa. Fale com o suporte.",
};

export async function signUpFromInvite(input: {
  token: string;
  password: string;
}): Promise<SignupFromInviteResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Cadastro temporariamente indisponível." };
  }
  const token = String(input.token ?? "");
  const password = String(input.password ?? "");
  if (password.length < 8 || password.length > 72) {
    return { ok: false, error: "A senha deve ter entre 8 e 72 caracteres." };
  }

  const supabase = await createClient();

  // 1. Validate the invite server-side and get its real e-mail.
  const { data: prep, error: prepErr } = await supabase.rpc(
    "prepare_invite_signup",
    { p_token_hash: hashToken(token) },
  );
  if (prepErr) {
    console.error("[prepare_invite_signup]", prepErr.code, prepErr.message);
    return { ok: false, error: "Não foi possível validar o convite." };
  }
  const prepared = prep as
    | { ok: true; email: string }
    | { ok: false; reason: string };
  if (!prepared.ok) {
    return { ok: false, error: SIGNUP_REASONS[prepared.reason] ?? SIGNUP_REASONS.invalid };
  }

  // 2. Create the account with the invite's e-mail — never the browser's.
  const { data: signUp, error: signErr } = await supabase.auth.signUp({
    email: prepared.email,
    password,
    options: { emailRedirectTo: buildInviteUrl(token) },
  });
  if (signErr) {
    const msg = signErr.message.toLowerCase();
    if (msg.includes("already registered") || msg.includes("already been registered")) {
      return {
        ok: false,
        accountExists: true,
        error: "Você já tem uma conta com este e-mail. Faça login para aceitar o convite.",
      };
    }
    if (msg.includes("weak") || msg.includes("password")) {
      return { ok: false, error: "Senha muito fraca. Use uma senha mais forte." };
    }
    console.error("[auth.signUp]", signErr.status, signErr.message);
    return { ok: false, error: "Não foi possível criar a conta." };
  }

  // 3a. E-mail confirmation ON -> no session yet. User confirms, comes back
  //     to /invite/[token] authenticated, and the existing accept flow runs.
  if (!signUp.session) {
    return { ok: true, needsEmailConfirmation: true };
  }

  // 3b. Confirmation OFF -> the server client now holds the session. Accept
  //     the invite right away.
  const { data: acc, error: accErr } = await supabase.rpc("accept_org_invite", {
    p_token_hash: hashToken(token),
  });
  if (accErr) {
    console.error("[accept_org_invite after signup]", accErr.code, accErr.message);
    // Account exists; they can retry acceptance from the invite page.
    return { ok: true, accepted: false };
  }
  void (acc as { status?: string });
  revalidatePath("/app", "layout");
  return { ok: true, accepted: true };
}
