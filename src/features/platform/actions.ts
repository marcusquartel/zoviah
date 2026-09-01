"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { generateSecureToken, hashToken } from "@/lib/secure-token";
import { buildInviteUrl } from "@/lib/app-url";
import { isReservedSubdomain, isValidSubdomainFormat } from "@/lib/tenant/host";
import { PLAN_CODES } from "@/features/platform/plans";
import { checkLogoFile } from "@/features/platform/branding";
import { getIsPlatformAdmin } from "@/features/platform/queries";
import type { OrganizationStatus, PlanCode } from "@/types/database";

const LOGO_BUCKET = "org-branding";

export interface AdminActionResult {
  ok: boolean;
  error?: string;
}

export interface CreateOrgResult extends AdminActionResult {
  organizationId?: string;
  /** Present when the owner e-mail has no account yet — the invite link. */
  ownerInviteUrl?: string;
}

const RPC_ERRORS: Record<string, string> = {
  FORBIDDEN: "Ação restrita a operadores da plataforma.",
  NOT_AUTHENTICATED: "Sessão expirada. Entre novamente.",
  INVALID_NAME: "Nome inválido.",
  INVALID_SLUG: "Slug inválido (use minúsculas, números e hífen).",
  SLUG_TAKEN: "Este slug já está em uso.",
  INVALID_SUBDOMAIN: "Subdomínio inválido (use minúsculas, números e hífen).",
  SUBDOMAIN_TAKEN: "Este subdomínio já está em uso.",
  SUBDOMAIN_RESERVED: "Este subdomínio é reservado.",
  INVALID_PLAN: "Plano inválido.",
  INVALID_STATUS: "Status inválido.",
  INVALID_OWNER_EMAIL: "E-mail do owner inválido.",
  INVALID_NOTES: "Nota muito longa.",
  ORGANIZATION_NOT_FOUND: "Organização não encontrada.",
  INVALID_LOGO_URL: "URL de logo inválida (use http/https).",
  INVALID_FAVICON_URL: "URL de favicon inválida (use http/https).",
};

function mapError(message: string | undefined): string {
  if (message) {
    for (const key of Object.keys(RPC_ERRORS)) {
      if (message.includes(key)) return RPC_ERRORS[key];
    }
  }
  return "Não foi possível concluir a ação.";
}

/**
 * Optional tenant subdomain. Empty string -> `undefined` (org has no tenant
 * host yet). Otherwise it must be a valid, non-reserved DNS label. Same rules
 * as `src/lib/tenant/host.ts` and the `admin_*` RPCs.
 */
const subdomainField = z
  .string()
  .trim()
  .transform((v) => v.toLowerCase())
  .refine((v) => v === "" || isValidSubdomainFormat(v), {
    error: "Subdomínio inválido (use minúsculas, números e hífen).",
  })
  .refine((v) => v === "" || !isReservedSubdomain(v), {
    error: "Este subdomínio é reservado.",
  })
  .transform((v) => (v === "" ? undefined : v))
  .optional();

const createSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z
    .string()
    .trim()
    .transform((v) => v.toLowerCase())
    .refine((v) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v) && v.length <= 63, {
      error: "Slug inválido.",
    }),
  subdomain: subdomainField,
  ownerEmail: z.email(),
  planCode: z.enum(PLAN_CODES as [PlanCode, ...PlanCode[]]),
  status: z.enum(["active", "suspended"] as [OrganizationStatus, OrganizationStatus]),
});

export async function createOrganization(input: {
  name: string;
  slug: string;
  subdomain?: string;
  ownerEmail: string;
  planCode: string;
  status: string;
}): Promise<CreateOrgResult> {
  if (!(await getIsPlatformAdmin())) {
    return { ok: false, error: RPC_ERRORS.FORBIDDEN };
  }
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  // Owner invite token: raw only lives here + in the returned URL.
  const rawToken = generateSecureToken();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_organization", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug,
    p_owner_email: parsed.data.ownerEmail,
    p_plan_code: parsed.data.planCode,
    p_status: parsed.data.status,
    p_owner_token_hash: hashToken(rawToken),
    p_subdomain: parsed.data.subdomain ?? null,
  });
  if (error) {
    console.error("[admin_create_organization]", error.code, error.message);
    return { ok: false, error: mapError(error.message) };
  }
  const result = data as {
    organization_id?: string;
    owner_invite_pending?: boolean;
  };
  revalidatePath("/admin");
  return {
    ok: true,
    organizationId: result.organization_id,
    ownerInviteUrl: result.owner_invite_pending
      ? buildInviteUrl(rawToken)
      : undefined,
  };
}

export async function setOrganizationStatus(
  organizationId: string,
  status: "active" | "suspended",
): Promise<AdminActionResult> {
  if (!(await getIsPlatformAdmin())) {
    return { ok: false, error: RPC_ERRORS.FORBIDDEN };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_organization_status", {
    p_organization_id: organizationId,
    p_status: status,
  });
  if (error) {
    console.error("[admin_set_organization_status]", error.code, error.message);
    return { ok: false, error: mapError(error.message) };
  }
  revalidatePath("/admin");
  return { ok: true };
}

export async function setOrganizationPlan(
  organizationId: string,
  planCode: string,
  notes?: string,
): Promise<AdminActionResult> {
  if (!(await getIsPlatformAdmin())) {
    return { ok: false, error: RPC_ERRORS.FORBIDDEN };
  }
  if (!(PLAN_CODES as readonly string[]).includes(planCode)) {
    return { ok: false, error: "Plano inválido." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_organization_plan", {
    p_organization_id: organizationId,
    p_plan_code: planCode,
    p_notes: notes?.trim() ? notes.trim().slice(0, 2000) : undefined,
  });
  if (error) {
    console.error("[admin_set_organization_plan]", error.code, error.message);
    return { ok: false, error: mapError(error.message) };
  }
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Set / change / clear an organization's tenant subdomain
 * (`<subdomain>.zoviah.app`). An empty string clears it. Slug is never
 * touched. Format / reserved / uniqueness are re-checked in the RPC.
 */
export async function setOrganizationSubdomain(
  organizationId: string,
  subdomain: string,
): Promise<AdminActionResult> {
  if (!(await getIsPlatformAdmin())) {
    return { ok: false, error: RPC_ERRORS.FORBIDDEN };
  }
  const parsed = subdomainField.safeParse(subdomain);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_organization_subdomain", {
    p_organization_id: organizationId,
    p_subdomain: parsed.data ?? null,
  });
  if (error) {
    console.error("[admin_set_organization_subdomain]", error.code, error.message);
    return { ok: false, error: mapError(error.message) };
  }
  revalidatePath("/admin");
  return { ok: true };
}

const httpUrlOrEmpty = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v), {
    error: "Use uma URL http(s) ou deixe em branco.",
  });

const brandingSchema = z.object({
  logoUrl: httpUrlOrEmpty,
  faviconUrl: httpUrlOrEmpty,
});

/**
 * Set an organization's logo / favicon URL from /admin — replaces the
 * hand-written `UPDATE organization_settings` an operator used to run in the
 * Supabase SQL editor. No upload/storage in this phase: URLs only.
 */
export async function setOrganizationBranding(
  organizationId: string,
  input: { logoUrl: string; faviconUrl: string },
): Promise<AdminActionResult> {
  if (!(await getIsPlatformAdmin())) {
    return { ok: false, error: RPC_ERRORS.FORBIDDEN };
  }
  const parsed = brandingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_organization_branding", {
    p_organization_id: organizationId,
    p_logo_url: parsed.data.logoUrl || null,
    p_favicon_url: parsed.data.faviconUrl || null,
  });
  if (error) {
    console.error("[admin_set_organization_branding]", error.code, error.message);
    return { ok: false, error: mapError(error.message) };
  }
  revalidatePath("/admin");
  revalidatePath("/app", "layout");
  return { ok: true };
}

export interface UploadLogoResult extends AdminActionResult {
  /** Public URL of the uploaded image, to store as the org's logo_url. */
  url?: string;
}

/**
 * Upload a tenant logo (PNG/JPG ≤ 1 MB) to the `org-branding` bucket and return
 * its public URL. Does not persist anything on the org — the caller passes the
 * URL to `setOrganizationBranding`. Platform-admin only (also enforced by the
 * bucket's RLS policy).
 */
export async function uploadOrganizationLogo(
  organizationId: string,
  formData: FormData,
): Promise<UploadLogoResult> {
  if (!(await getIsPlatformAdmin())) {
    return { ok: false, error: RPC_ERRORS.FORBIDDEN };
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "Nenhum arquivo enviado." };
  }
  const check = checkLogoFile({ type: file.type, size: file.size });
  if (!check.ok) return { ok: false, error: check.error };

  const supabase = await createClient();
  const path = `${organizationId}/logo-${Date.now()}.${check.ext}`;
  const { error: upErr } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (upErr) {
    console.error("[uploadOrganizationLogo]", upErr.message);
    return { ok: false, error: "Não foi possível enviar a imagem." };
  }
  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
