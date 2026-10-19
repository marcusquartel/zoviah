"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { getAppBaseUrl } from "@/lib/app-url";
import { ingestKey, isSecretBoxConfigured, seal, sha256Hex } from "@/lib/crypto/secret-box";
import {
  requestAccessToken,
  ShopifyClient,
  ShopifyError,
  type ConnectionSecrets,
} from "@/lib/shopify/client";
import { createDiscountCode, registerWebhooks, syncRecent } from "@/lib/shopify/sync";
import { normalizeAffiliateCode, normalizeShopDomain } from "@/lib/shopify/parse";

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}

const RPC_ERRORS: Record<string, string> = {
  NOT_AUTHENTICATED: "Sessão expirada. Entre novamente.",
  FORBIDDEN: "Apenas owners e admins podem fazer isso.",
  INVALID_SHOP_DOMAIN: "Domínio da loja inválido (use loja.myshopify.com).",
  SHOP_ALREADY_CONNECTED: "Esta loja já está conectada a outra organização.",
  CREATOR_NOT_FOUND: "Creator não encontrada.",
  INVALID_CODE: "Código inválido: use 3 a 40 letras, números, - ou _.",
  INVALID_RATE: "A comissão deve estar entre 0% e 100%.",
  INVALID_DISCOUNT: "O desconto deve estar entre 0% e 100%.",
  CODE_TAKEN: "Este código já é de outra creator.",
  INVALID_PAYLOAD: "Dados inválidos.",
};

function mapError(message: string | undefined, fallback: string): string {
  if (message) {
    for (const k of Object.keys(RPC_ERRORS)) if (message.includes(k)) return RPC_ERRORS[k];
  }
  return fallback;
}

function webhookEndpoint(): string | null {
  const base = getAppBaseUrl();
  // Shopify only delivers to public HTTPS endpoints.
  return base.startsWith("https://") && !/localhost|127\.0\.0\.1/.test(base)
    ? `${base}/api/shopify/webhooks`
    : null;
}

async function loadClient(orgId: string): Promise<ShopifyClient | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("shopify_connection_secrets_for_org", { p_org: orgId });
  const secrets = data as unknown as ConnectionSecrets | null;
  if (!secrets?.secret_enc) return null;
  return new ShopifyClient(supabase, secrets);
}

/** Sync recent orders and record the outcome on the connection. */
async function runSync(client: ShopifyClient, days: number, withWebhooks: boolean) {
  let webhooksOk: boolean | null = null;
  try {
    if (withWebhooks) {
      const endpoint = webhookEndpoint();
      webhooksOk = endpoint ? await registerWebhooks(client, endpoint) : false;
    }
    const r = await syncRecent(client, days);
    await client.db.rpc("shopify_record_sync", {
      p_org: client.organizationId,
      p_ingest_key: client.ingestKey,
      p_error: null,
      p_webhooks_ok: webhooksOk,
    });
    return r;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erro ao sincronizar.";
    await client.db.rpc("shopify_record_sync", {
      p_org: client.organizationId,
      p_ingest_key: client.ingestKey,
      p_error: msg.slice(0, 300),
      p_webhooks_ok: webhooksOk,
    });
    throw e;
  }
}

const connectSchema = z.object({
  shopDomain: z.string().trim().min(1, { error: "Informe o domínio da loja." }),
  clientId: z.string().trim().min(8, { error: "Informe o Client ID." }).max(200),
  clientSecret: z.string().trim().min(8, { error: "Informe o Client secret." }).max(500),
});

export async function connectShopify(input: z.input<typeof connectSchema>): Promise<ActionResult> {
  const parsed = connectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  if (!isSecretBoxConfigured()) {
    return { ok: false, error: "Integração indisponível: chave de criptografia do servidor ausente." };
  }
  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };
  if (current.role === "analyst") return { ok: false, error: RPC_ERRORS.FORBIDDEN };

  const shop = normalizeShopDomain(parsed.data.shopDomain);
  if (!shop) return { ok: false, error: RPC_ERRORS.INVALID_SHOP_DOMAIN };

  let token: Awaited<ReturnType<typeof requestAccessToken>>;
  try {
    token = await requestAccessToken(shop, parsed.data.clientId, parsed.data.clientSecret);
  } catch (e) {
    return { ok: false, error: e instanceof ShopifyError ? e.message : "Não foi possível validar as credenciais." };
  }

  const orgId = current.organization.id;
  const supabase = await createClient();
  const { error } = await supabase.rpc("shopify_connect", {
    p_org: orgId,
    p_shop_domain: shop,
    p_client_id: parsed.data.clientId,
    p_secret_enc: seal(parsed.data.clientSecret),
    p_token_enc: seal(token.accessToken),
    p_token_expires_at: token.expiresAt.toISOString(),
    p_scopes: token.scope,
    p_ingest_key_hash: sha256Hex(ingestKey(orgId)),
  });
  if (error) return { ok: false, error: mapError(error.message, "Não foi possível salvar a conexão.") };

  const missing = ["read_orders", "write_discounts"].filter((s) => !token.scope.split(",").includes(s));

  // Webhooks + the 60-day backfill run after the response.
  after(async () => {
    const client = await loadClient(orgId);
    if (client) await runSync(client, 60, true).catch(() => undefined);
  });

  revalidatePath("/app/shopify");
  return {
    ok: true,
    message: missing.length
      ? `Loja conectada, mas faltam escopos no app: ${missing.join(", ")}.`
      : "Loja conectada. Importando os pedidos dos últimos 60 dias…",
  };
}

export async function syncShopifyNow(): Promise<ActionResult> {
  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };
  const client = await loadClient(current.organization.id);
  if (!client) return { ok: false, error: "Nenhuma loja conectada." };
  try {
    const r = await runSync(client, 60, true);
    revalidatePath("/app/shopify");
    revalidatePath("/app/commissions");
    return {
      ok: true,
      message: `${r.orders} pedido(s) sincronizado(s)${r.journey ? "" : " (sem UTM: a Shopify não liberou a jornada do cliente)"}.`,
    };
  } catch (e) {
    revalidatePath("/app/shopify");
    return { ok: false, error: e instanceof Error ? e.message : "Erro ao sincronizar." };
  }
}

/** Background refresh when a page is opened and the last sync is old. */
export async function scheduleAutoSync(orgId: string): Promise<void> {
  after(async () => {
    const client = await loadClient(orgId).catch(() => null);
    if (client) await runSync(client, 3, false).catch(() => undefined);
  });
}

export async function disconnectShopify(): Promise<ActionResult> {
  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("shopify_disconnect", { p_org: current.organization.id });
  if (error) return { ok: false, error: mapError(error.message, "Não foi possível desconectar.") };
  revalidatePath("/app/shopify");
  return { ok: true, message: "Loja desconectada." };
}

const affiliationSchema = z.object({
  creatorId: z.uuid(),
  code: z.string().trim(),
  commissionRate: z.coerce.number().min(0, { error: RPC_ERRORS.INVALID_RATE }).max(100, { error: RPC_ERRORS.INVALID_RATE }),
  discountPercent: z.coerce.number().min(0).max(100).nullable(),
  createCoupon: z.boolean(),
  active: z.boolean().default(true),
});

export async function saveCreatorAffiliation(
  input: z.input<typeof affiliationSchema>,
): Promise<ActionResult> {
  const parsed = affiliationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const code = normalizeAffiliateCode(parsed.data.code);
  if (!code) return { ok: false, error: RPC_ERRORS.INVALID_CODE };

  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };
  if (current.role === "analyst") return { ok: false, error: RPC_ERRORS.FORBIDDEN };
  const orgId = current.organization.id;
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("creator_affiliations")
    .select("code, shopify_discount_id")
    .eq("organization_id", orgId)
    .eq("creator_id", parsed.data.creatorId)
    .maybeSingle();

  let discountId: string | null = null;
  const needsCoupon =
    parsed.data.createCoupon &&
    parsed.data.discountPercent != null &&
    (!existing?.shopify_discount_id || existing.code !== code);
  if (needsCoupon) {
    const client = await loadClient(orgId);
    if (!client) return { ok: false, error: "Conecte a loja Shopify para criar o cupom." };
    try {
      discountId = await createDiscountCode(client, code, parsed.data.discountPercent!);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Não foi possível criar o cupom." };
    }
  }

  const { error } = await supabase.rpc("set_creator_affiliation", {
    p_org: orgId,
    p_creator_id: parsed.data.creatorId,
    p_code: code,
    p_commission_rate: parsed.data.commissionRate,
    p_discount_percent: parsed.data.discountPercent,
    p_shopify_discount_id: discountId,
    p_active: parsed.data.active,
  });
  if (error) return { ok: false, error: mapError(error.message, "Não foi possível salvar.") };

  revalidatePath("/app/commissions");
  revalidatePath("/app/creators");
  return {
    ok: true,
    message: discountId ? `Cupom ${code} criado na loja e vinculado.` : "Dados de comissão salvos.",
  };
}

export async function markCommissionsPaid(ids: string[]): Promise<ActionResult> {
  const parsed = z.array(z.uuid()).min(1).max(1000).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Selecione ao menos uma comissão." };
  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_commissions_paid", {
    p_org: current.organization.id,
    p_ids: parsed.data,
  });
  if (error) return { ok: false, error: mapError(error.message, "Não foi possível marcar como pago.") };
  revalidatePath("/app/commissions");
  const n = (data as { paid?: number } | null)?.paid ?? 0;
  return { ok: true, message: `${n} comissão(ões) marcada(s) como paga(s).` };
}

export async function setCommissionHoldDays(days: number): Promise<ActionResult> {
  const parsed = z.coerce.number().int().min(0).max(365).safeParse(days);
  if (!parsed.success) return { ok: false, error: "Informe um prazo entre 0 e 365 dias." };
  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_commission_hold_days", {
    p_org: current.organization.id,
    p_days: parsed.data,
  });
  if (error) return { ok: false, error: mapError(error.message, "Não foi possível salvar.") };
  revalidatePath("/app/commissions");
  return { ok: true, message: "Prazo de aprovação atualizado." };
}
