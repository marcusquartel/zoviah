import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { open } from "@/lib/crypto/secret-box";
import { ShopifyClient, type ConnectionSecrets } from "@/lib/shopify/client";
import { syncOrder } from "@/lib/shopify/sync";
import { normalizeShopDomain, verifyWebhookHmac } from "@/lib/shopify/parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Shopify webhook endpoint (orders/create, orders/updated, orders/cancelled,
 * app/uninstalled). No user session: the shop is identified by header, the
 * HMAC is checked with that shop's client secret, and writes go through
 * ingest-key-gated RPCs. Shopify needs a 200 within 5s, so the order re-fetch
 * runs after the response.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const shop = normalizeShopDomain(req.headers.get("x-shopify-shop-domain") ?? "");
  const topic = (req.headers.get("x-shopify-topic") ?? "").toLowerCase();
  if (!shop) return new Response("unknown shop", { status: 400 });

  const db = await createClient();
  const { data } = await db.rpc("shopify_connection_secrets", { p_shop_domain: shop });
  const secrets = data as unknown as ConnectionSecrets | null;
  if (!secrets?.secret_enc) {
    // Unknown or disconnected shop: acknowledge so Shopify stops retrying.
    return new Response("ok", { status: 200 });
  }

  let secret: string;
  try {
    secret = open(secrets.secret_enc);
  } catch {
    return new Response("server key mismatch", { status: 500 });
  }
  if (!verifyWebhookHmac(raw, req.headers.get("x-shopify-hmac-sha256"), secret)) {
    return new Response("invalid signature", { status: 401 });
  }

  const client = new ShopifyClient(db, secrets);

  if (topic === "app/uninstalled") {
    await db.rpc("shopify_mark_uninstalled", {
      p_org: client.organizationId,
      p_ingest_key: client.ingestKey,
    });
    return new Response("ok", { status: 200 });
  }

  if (topic.startsWith("orders/")) {
    let gid: string | null = null;
    try {
      const body = JSON.parse(raw) as { admin_graphql_api_id?: string; id?: number };
      gid = body.admin_graphql_api_id ?? (body.id ? `gid://shopify/Order/${body.id}` : null);
    } catch {
      return new Response("bad payload", { status: 400 });
    }
    if (gid) {
      const orderId = gid;
      after(async () => {
        try {
          await syncOrder(client, orderId);
        } catch (e) {
          console.error("[shopify webhook] sync failed", {
            topic,
            message: e instanceof Error ? e.message : String(e),
          });
          await db.rpc("shopify_record_sync", {
            p_org: client.organizationId,
            p_ingest_key: client.ingestKey,
            p_error: e instanceof Error ? e.message.slice(0, 300) : "Erro ao processar webhook.",
            p_webhooks_ok: null,
          });
        }
      });
    }
  }

  return new Response("ok", { status: 200 });
}
