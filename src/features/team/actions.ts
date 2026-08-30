"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { generateSecureToken, hashToken } from "@/lib/secure-token";
import { buildInviteUrl } from "@/lib/app-url";
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
