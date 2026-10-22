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
import {
  createDiscountCode,
  listDiscountCodes,
  registerWebhooks,
  rememberShopDomain,
  syncRecent,
  type StoreDiscountCode,
} from "@/lib/shopify/sync";
import { normalizeAffiliateCode, normalizeShopDomain } from "@/lib/shopify/parse";
import { deliverSaleNotifications } from "@/lib/notifications/deliver";
import type { Json } from "@/types/database";

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
  INVALID_NAME: "Informe o nome de cada influenciadora (até 150 caracteres).",
  CODE_IS_PERSONAL: "Este código já é o cupom pessoal de uma creator.",
  CODE_IS_AFFILIATE: "Este código já é um cupom de divulgação (comissionado).",
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
    await rememberShopDomain(client);
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
    await deliverSaleNotifications(client).catch((e) =>
      console.error("[sale notifications] after sync", e instanceof Error ? e.message : e),
    );
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
  // null = coupon linked, commission not agreed yet (no commission computed).
  commissionRate: z
    .number()
    .min(0, { error: RPC_ERRORS.INVALID_RATE })
    .max(100, { error: RPC_ERRORS.INVALID_RATE })
    .nullable(),
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

const personalCouponSchema = z.object({
  creatorId: z.uuid(),
  code: z.string().trim().max(40),
  discountPercent: z.number().min(0).max(100).nullable(),
});

/**
 * The creator's own discount code. Never attributed, so it earns no
 * commission. An empty code removes it. Links an existing store coupon by
 * code; it does not create one in Shopify.
 */
export async function savePersonalCoupon(
  input: z.input<typeof personalCouponSchema>,
): Promise<ActionResult> {
  const parsed = personalCouponSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const code = parsed.data.code ? normalizeAffiliateCode(parsed.data.code) : "";
  if (parsed.data.code && !code) return { ok: false, error: RPC_ERRORS.INVALID_CODE };

  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };
  if (current.role === "analyst") return { ok: false, error: RPC_ERRORS.FORBIDDEN };

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_creator_personal_coupon", {
    p_creator_id: parsed.data.creatorId,
    p_code: code ?? "",
    p_discount_percent: parsed.data.discountPercent,
  });
  if (error) return { ok: false, error: mapError(error.message, "Não foi possível salvar o cupom pessoal.") };

  revalidatePath("/app/creators");
  return { ok: true, message: code ? "Cupom pessoal salvo." : "Cupom pessoal removido." };
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

/** Per-org switch for the "nova venda" e-mails to creators. */
export async function setSaleNotifications(enabled: boolean): Promise<ActionResult> {
  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };
  if (current.role === "analyst") return { ok: false, error: RPC_ERRORS.FORBIDDEN };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_sale_notifications", {
    p_org: current.organization.id,
    p_enabled: enabled,
  });
  if (error) return { ok: false, error: mapError(error.message, "Não foi possível salvar.") };
  revalidatePath("/app/commissions");
  return {
    ok: true,
    message: enabled
      ? "Avisos ligados: as creators recebem um e-mail a cada nova venda paga."
      : "Avisos de venda desligados.",
  };
}

/** Per-creator opt-out of the "nova venda" e-mails. */
export async function setCreatorNotifySales(creatorId: string, enabled: boolean): Promise<ActionResult> {
  if (!z.uuid().safeParse(creatorId).success) return { ok: false, error: RPC_ERRORS.CREATOR_NOT_FOUND };
  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };
  if (current.role === "analyst") return { ok: false, error: RPC_ERRORS.FORBIDDEN };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_creator_notify_sales", {
    p_creator_id: creatorId,
    p_enabled: enabled,
  });
  if (error) return { ok: false, error: mapError(error.message, "Não foi possível salvar.") };
  revalidatePath("/app/creators");
  return { ok: true };
}

export interface ImportableCode extends StoreDiscountCode {
  orders: number;
  sales: number;
}

/** Store coupons not yet linked to a creator, with their usage in synced orders. */
export async function loadImportableCodes(): Promise<{ ok: boolean; error?: string; codes?: ImportableCode[] }> {
  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };
  const orgId = current.organization.id;
  const client = await loadClient(orgId);
  if (!client) return { ok: false, error: "Conecte a loja Shopify primeiro." };

  let codes: StoreDiscountCode[];
  try {
    codes = await listDiscountCodes(client);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não foi possível ler os cupons da loja." };
  }
  const supabase = await createClient();
  const [{ data: linked }, { data: orders }] = await Promise.all([
    supabase.from("creator_affiliations").select("code").eq("organization_id", orgId),
    supabase
      .from("shopify_orders")
      .select("discount_codes, subtotal, cancelled_at, test")
      .eq("organization_id", orgId)
      .limit(20000),
  ]);
  const taken = new Set((linked ?? []).map((l) => l.code.toUpperCase()));
  const usage = new Map<string, { orders: number; sales: number }>();
  for (const o of orders ?? []) {
    if (o.test || o.cancelled_at) continue;
    for (const c of o.discount_codes ?? []) {
      const k = c.toUpperCase();
      const u = usage.get(k) ?? { orders: 0, sales: 0 };
      u.orders += 1;
      u.sales += Number(o.subtotal);
      usage.set(k, u);
    }
  }
  return {
    ok: true,
    codes: codes
      .filter((c) => !taken.has(c.code.toUpperCase()))
      .map((c) => ({ ...c, ...(usage.get(c.code.toUpperCase()) ?? { orders: 0, sales: 0 }) }))
      .sort((a, b) => b.sales - a.sales || a.code.localeCompare(b.code)),
  };
}

const importSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1, { error: RPC_ERRORS.INVALID_NAME }).max(150),
      code: z.string().trim().min(3).max(40),
      commissionRate: z.coerce.number().min(0, { error: RPC_ERRORS.INVALID_RATE }).max(100, { error: RPC_ERRORS.INVALID_RATE }),
      discountPercent: z.number().min(0).max(100).nullable(),
      shopifyDiscountId: z.string().max(200).nullable(),
      instagram: z.string().trim().max(60).optional(),
    }),
  )
  .min(1, { error: "Selecione ao menos um cupom." })
  .max(200, { error: "Importe no máximo 200 por vez." });

export async function importAffiliations(input: z.input<typeof importSchema>): Promise<ActionResult> {
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };
  if (current.role === "analyst") return { ok: false, error: RPC_ERRORS.FORBIDDEN };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("import_creator_affiliations", {
    p_org: current.organization.id,
    p_items: parsed.data.map((i) => ({
      name: i.name,
      code: i.code.toUpperCase(),
      commission_rate: i.commissionRate,
      discount_percent: i.discountPercent,
      shopify_discount_id: i.shopifyDiscountId,
      instagram: i.instagram ?? null,
    })) as unknown as Json,
  });
  if (error) return { ok: false, error: mapError(error.message, "Não foi possível importar.") };
  const r = (data ?? {}) as { imported?: number; skipped?: number };
  revalidatePath("/app/commissions");
  revalidatePath("/app/creators");
  return {
    ok: true,
    message: `${r.imported ?? 0} influenciadora(s) importada(s)${r.skipped ? `, ${r.skipped} já vinculada(s)` : ""}. As vendas anteriores já foram atribuídas.`,
  };
}
