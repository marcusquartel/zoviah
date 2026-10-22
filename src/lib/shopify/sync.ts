/**
 * Order sync, webhook registration and discount creation on top of
 * ShopifyClient. SERVER ONLY.
 */
import { ShopifyClient, ShopifyError } from "@/lib/shopify/client";
import { toIngestOrder, type ShopifyOrderNode } from "@/lib/shopify/parse";
import type { Json } from "@/types/database";

const ORDER_FIELDS = `
  id name processedAt createdAt cancelledAt displayFinancialStatus test currencyCode
  discountCodes
  currentSubtotalPriceSet { shopMoney { amount } }
  totalDiscountsSet { shopMoney { amount } }
  totalRefundedSet { shopMoney { amount } }
`;
const JOURNEY_FIELDS = `
  customerJourneySummary {
    firstVisit { landingPage utmParameters { source medium campaign content term } }
    lastVisit { landingPage utmParameters { source medium campaign content term } }
  }
`;

function ordersQuery(withJourney: boolean) {
  return `query Orders($cursor: String, $q: String) {
    orders(first: 100, after: $cursor, query: $q, sortKey: PROCESSED_AT) {
      pageInfo { hasNextPage endCursor }
      nodes { ${ORDER_FIELDS} ${withJourney ? JOURNEY_FIELDS : ""} }
    }
  }`;
}

function orderQuery(withJourney: boolean) {
  return `query Order($id: ID!) { order(id: $id) { ${ORDER_FIELDS} ${withJourney ? JOURNEY_FIELDS : ""} } }`;
}

async function ingest(client: ShopifyClient, nodes: ShopifyOrderNode[]) {
  for (let i = 0; i < nodes.length; i += 100) {
    const batch = nodes.slice(i, i + 100).map(toIngestOrder);
    const res = await client.db.rpc("shopify_ingest_orders", {
      p_org: client.organizationId,
      p_ingest_key: client.ingestKey,
      p_orders: batch as unknown as Json,
    });
    if (res.error) throw new ShopifyError(`Falha ao gravar pedidos: ${res.error.message}`);
  }
}

/**
 * Fetch orders matching a Shopify search query (e.g. `updated_at:>=2026-10-01`)
 * and ingest them. The customer journey (UTM) needs the same `read_orders`
 * scope but can be refused for protected customer data — then orders are
 * synced without UTM rather than not at all.
 */
export async function syncOrders(
  client: ShopifyClient,
  search: string,
  maxPages = 50,
): Promise<{ orders: number; journey: boolean }> {
  let withJourney = true;
  let cursor: string | null = null;
  let total = 0;
  for (let page = 0; page < maxPages; page++) {
    type R = { orders: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: ShopifyOrderNode[] } };
    let data: R;
    try {
      data = await client.graphql<R>(ordersQuery(withJourney), { cursor, q: search });
    } catch (e) {
      if (withJourney && e instanceof ShopifyError && e.code !== "NETWORK" && e.code !== "AUTH") {
        withJourney = false;
        page--;
        continue;
      }
      throw e;
    }
    const nodes = data.orders.nodes;
    if (nodes.length) {
      await ingest(client, nodes);
      total += nodes.length;
    }
    if (!data.orders.pageInfo.hasNextPage) break;
    cursor = data.orders.pageInfo.endCursor;
  }
  return { orders: total, journey: withJourney };
}

/** Re-fetch a single order (webhooks) and ingest it. */
export async function syncOrder(client: ShopifyClient, orderGid: string): Promise<void> {
  type R = { order: ShopifyOrderNode | null };
  let data: R;
  try {
    data = await client.graphql<R>(orderQuery(true), { id: orderGid });
  } catch (e) {
    if (e instanceof ShopifyError && e.code !== "NETWORK" && e.code !== "AUTH") {
      data = await client.graphql<R>(orderQuery(false), { id: orderGid });
    } else {
      throw e;
    }
  }
  if (data.order) await ingest(client, [data.order]);
}

/** Full sync used on connect / "Sincronizar agora": last `days` + anything updated since. */
export async function syncRecent(client: ShopifyClient, days: number) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  return syncOrders(client, `updated_at:>=${since}`);
}

const WEBHOOK_TOPICS = ["ORDERS_CREATE", "ORDERS_UPDATED", "ORDERS_CANCELLED", "APP_UNINSTALLED"] as const;

/** Subscribe the shop's order webhooks to our endpoint. Idempotent. */
/**
 * Record the shop's permanent "<id>.myshopify.com" domain. Webhooks identify
 * the shop by it, which may differ from the alias typed on connect.
 */
export async function rememberShopDomain(client: ShopifyClient): Promise<void> {
  type R = { shop: { myshopifyDomain: string } };
  const data = await client.graphql<R>("query { shop { myshopifyDomain } }");
  const { error } = await client.db.rpc("shopify_set_myshopify_domain", {
    p_org: client.organizationId,
    p_ingest_key: client.ingestKey,
    p_domain: data.shop.myshopifyDomain,
  });
  if (error) throw new ShopifyError(`Falha ao gravar o domínio da loja: ${error.message}`);
}

export async function registerWebhooks(client: ShopifyClient, endpoint: string): Promise<boolean> {
  type R = {
    webhookSubscriptionCreate: {
      webhookSubscription: { id: string } | null;
      userErrors: { field: string[] | null; message: string }[];
    };
  };
  let ok = true;
  for (const topic of WEBHOOK_TOPICS) {
    const attempts = [
      { field: "uri", m: `mutation($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) { webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) { webhookSubscription { id } userErrors { field message } } }`, sub: { uri: endpoint, format: "JSON" } },
      { field: "callbackUrl", m: `mutation($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) { webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) { webhookSubscription { id } userErrors { field message } } }`, sub: { callbackUrl: endpoint, format: "JSON" } },
    ];
    let done = false;
    for (const a of attempts) {
      try {
        const r = await client.graphql<R>(a.m, { topic, sub: a.sub });
        const errs = r.webhookSubscriptionCreate.userErrors;
        // "already been taken" = this address is already subscribed: fine.
        if (!errs.length || errs.every((e) => /taken|already/i.test(e.message))) {
          done = true;
          break;
        }
      } catch (e) {
        if (e instanceof ShopifyError && (e.code === "NETWORK" || e.code === "AUTH")) throw e;
        // Unknown input field for this API version: try the next shape.
      }
    }
    if (!done) ok = false;
  }
  return ok;
}

/**
 * Create a percentage code discount usable by everyone (no end date). Tries
 * the current input shape (`context`) and falls back to the older
 * `customerSelection` shape.
 */
export async function createDiscountCode(
  client: ShopifyClient,
  code: string,
  percent: number,
): Promise<string> {
  type R = {
    discountCodeBasicCreate: {
      codeDiscountNode: { id: string } | null;
      userErrors: { field: string[] | null; message: string; code?: string | null }[];
    };
  };
  const mutation = `mutation($d: DiscountCodeBasicInput!) {
    discountCodeBasicCreate(basicCodeDiscount: $d) {
      codeDiscountNode { id }
      userErrors { field message code }
    }
  }`;
  const base = {
    title: `Zoviah · ${code}`,
    code,
    startsAt: new Date().toISOString(),
    customerGets: { value: { percentage: Math.min(Math.max(percent, 0), 100) / 100 }, items: { all: true } },
    appliesOncePerCustomer: false,
  };
  const shapes = [{ ...base, context: { all: "ALL" } }, { ...base, customerSelection: { all: true } }];
  let lastMessage = "Não foi possível criar o cupom na Shopify.";
  for (const d of shapes) {
    try {
      const r = await client.graphql<R>(mutation, { d });
      const node = r.discountCodeBasicCreate.codeDiscountNode;
      if (node) return node.id;
      const errs = r.discountCodeBasicCreate.userErrors;
      lastMessage = errs.map((e) => e.message).join("; ") || lastMessage;
      if (errs.some((e) => /taken|already|único|unique/i.test(e.message))) {
        throw new ShopifyError(`O cupom ${code} já existe na loja. Escolha outro código.`);
      }
    } catch (e) {
      if (e instanceof ShopifyError && (e.code === "NETWORK" || e.code === "AUTH" || /já existe/.test(e.message))) {
        throw e;
      }
      if (e instanceof ShopifyError) lastMessage = e.message;
    }
  }
  throw new ShopifyError(lastMessage);
}

export interface StoreDiscountCode {
  /** DiscountCodeNode GID — stored as `shopify_discount_id`. */
  id: string;
  code: string;
  title: string;
  status: string;
  /** Percentage off (0–100) for percentage discounts, else null. */
  percent: number | null;
}

/** Every code discount in the store (all pages, up to `max`). */
export async function listDiscountCodes(client: ShopifyClient, max = 1000): Promise<StoreDiscountCode[]> {
  const codesFrag = "title status codes(first: 1) { nodes { code } }";
  const query = `query Codes($cursor: String) {
    codeDiscountNodes(first: 100, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        codeDiscount {
          __typename
          ... on DiscountCodeBasic { ${codesFrag} customerGets { value { ... on DiscountPercentage { percentage } } } }
          ... on DiscountCodeBxgy { ${codesFrag} }
          ... on DiscountCodeFreeShipping { ${codesFrag} }
        }
      }
    }
  }`;
  type Node = {
    id: string;
    codeDiscount: {
      title?: string;
      status?: string;
      codes?: { nodes: { code: string }[] };
      customerGets?: { value?: { percentage?: number | null } | null } | null;
    } | null;
  };
  type R = { codeDiscountNodes: { pageInfo: { hasNextPage: boolean; endCursor: string | null }; nodes: Node[] } };
  const out: StoreDiscountCode[] = [];
  let cursor: string | null = null;
  while (out.length < max) {
    const data: R = await client.graphql<R>(query, { cursor });
    for (const n of data.codeDiscountNodes.nodes) {
      const d = n.codeDiscount;
      const code = d?.codes?.nodes[0]?.code;
      if (!d || !code) continue;
      const pct = d.customerGets?.value?.percentage;
      out.push({
        id: n.id,
        code,
        title: d.title ?? code,
        status: d.status ?? "",
        percent: typeof pct === "number" ? Math.round(pct * 10000) / 100 : null,
      });
    }
    if (!data.codeDiscountNodes.pageInfo.hasNextPage) break;
    cursor = data.codeDiscountNodes.pageInfo.endCursor;
  }
  return out;
}
