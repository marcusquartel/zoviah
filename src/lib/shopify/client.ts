/**
 * Shopify Admin API access for a tenant-owned Dev Dashboard app (client
 * credentials grant: 24h tokens, refreshed with the client secret). SERVER
 * ONLY. Secrets arrive as ciphertext from the DB and are opened here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ingestKey, open, seal } from "@/lib/crypto/secret-box";
import { SHOPIFY_API_VERSION } from "@/lib/shopify/parse";

type Db = SupabaseClient<Database>;

export interface ConnectionSecrets {
  organization_id: string;
  shop_domain: string;
  client_id: string;
  secret_enc: string | null;
  token_enc: string | null;
  token_expires_at: string | null;
}

export class ShopifyError extends Error {
  constructor(
    message: string,
    readonly code: "AUTH" | "SCOPE" | "NETWORK" | "API" = "API",
  ) {
    super(message);
  }
}

/** Exchange client id + secret for a 24h access token. */
export async function requestAccessToken(
  shop: string,
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; scope: string; expiresAt: Date }> {
  let res: Response;
  try {
    res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
      cache: "no-store",
    });
  } catch {
    throw new ShopifyError("Não foi possível falar com a loja Shopify.", "NETWORK");
  }
  const text = await res.text();
  if (!res.ok) {
    if (/shop_not_permitted/i.test(text)) {
      throw new ShopifyError(
        "Este app não pertence à mesma organização da loja. Crie o app no Dev Dashboard da própria loja.",
        "AUTH",
      );
    }
    throw new ShopifyError(
      res.status === 400 || res.status === 401
        ? "Client ID ou Client secret inválidos — ou o app ainda não foi instalado na loja."
        : `A Shopify recusou a conexão (HTTP ${res.status}).`,
      "AUTH",
    );
  }
  const data = JSON.parse(text) as { access_token: string; scope?: string; expires_in?: number };
  return {
    accessToken: data.access_token,
    scope: data.scope ?? "",
    expiresAt: new Date(Date.now() + (data.expires_in ?? 86399) * 1000),
  };
}

export class ShopifyClient {
  private token: string | null;
  private expiresAt: number;
  private readonly secret: string;

  constructor(
    readonly db: Db,
    readonly conn: ConnectionSecrets,
  ) {
    if (!conn.secret_enc) throw new ShopifyError("Loja desconectada.", "AUTH");
    this.secret = open(conn.secret_enc);
    this.token = conn.token_enc ? open(conn.token_enc) : null;
    this.expiresAt = conn.token_expires_at ? Date.parse(conn.token_expires_at) : 0;
  }

  get organizationId(): string {
    return this.conn.organization_id;
  }

  get clientSecret(): string {
    return this.secret;
  }

  get ingestKey(): string {
    return ingestKey(this.conn.organization_id);
  }

  private async accessToken(): Promise<string> {
    // Refresh 10 minutes early.
    if (this.token && this.expiresAt - Date.now() > 10 * 60 * 1000) return this.token;
    const t = await requestAccessToken(this.conn.shop_domain, this.conn.client_id, this.secret);
    this.token = t.accessToken;
    this.expiresAt = t.expiresAt.getTime();
    await this.db.rpc("shopify_save_token", {
      p_org: this.conn.organization_id,
      p_ingest_key: this.ingestKey,
      p_token_enc: seal(t.accessToken),
      p_expires_at: t.expiresAt.toISOString(),
    });
    return t.accessToken;
  }

  async graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
    const token = await this.accessToken();
    let res: Response;
    try {
      res = await fetch(
        `https://${this.conn.shop_domain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
          body: JSON.stringify({ query, variables }),
          cache: "no-store",
        },
      );
    } catch {
      throw new ShopifyError("Não foi possível falar com a loja Shopify.", "NETWORK");
    }
    if (res.status === 401 || res.status === 403) {
      throw new ShopifyError("Acesso negado pela Shopify. Confira se o app está instalado e com os escopos.", "AUTH");
    }
    const body = (await res.json()) as { data?: T; errors?: { message: string }[] | string };
    if (body.errors) {
      const msg = Array.isArray(body.errors)
        ? body.errors.map((e) => e.message).join("; ")
        : String(body.errors);
      throw new ShopifyError(msg, /access|scope|permission/i.test(msg) ? "SCOPE" : "API");
    }
    return body.data as T;
  }
}

/** Load a client from ciphertext via the given (session or anon) Supabase client. */
export function clientFromSecrets(db: Db, secrets: ConnectionSecrets): ShopifyClient {
  return new ShopifyClient(db, secrets);
}
