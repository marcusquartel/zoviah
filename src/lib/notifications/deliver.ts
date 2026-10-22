/**
 * Sends the queued "nova venda" e-mails for one organization (SERVER ONLY).
 * Called after a Shopify webhook / sync has ingested orders. The queue rows
 * are filled by a DB trigger; here we only claim, send through Resend and
 * record the outcome. Without RESEND_API_KEY nothing is claimed, so the
 * notices simply wait.
 */
import type { ShopifyClient } from "@/lib/shopify/client";
import { buildSaleEmail, type SaleNotice } from "@/lib/notifications/sale-email";

const DEFAULT_FROM_ADDRESS = "avisos@auth.zoviah.app";

function fromHeader(organizationName: string): string {
  const address = process.env.SALE_EMAIL_FROM?.trim() || DEFAULT_FROM_ADDRESS;
  // Display names can't carry quotes / angle brackets unescaped.
  const name = `${organizationName} via Zoviah`.replace(/["<>]/g, "");
  return `"${name}" <${address}>`;
}

async function sendEmail(apiKey: string, notice: SaleNotice): Promise<string | null> {
  const mail = buildSaleEmail(notice);
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        // Same notice retried → Resend sends it once.
        "Idempotency-Key": `sale-notice-${notice.id}`,
      },
      body: JSON.stringify({
        from: fromHeader(notice.organization_name),
        to: [notice.creator_email],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
      }),
      cache: "no-store",
    });
  } catch {
    return "Falha de rede ao falar com o Resend.";
  }
  if (res.ok) return null;
  const body = await res.text().catch(() => "");
  return `Resend HTTP ${res.status}: ${body.slice(0, 200)}`;
}

export async function deliverSaleNotifications(client: ShopifyClient): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return;

  const auth = { p_org: client.organizationId, p_ingest_key: client.ingestKey };
  const { data, error } = await client.db.rpc("claim_sale_notifications", { ...auth, p_limit: 20 });
  if (error) {
    console.error("[sale notifications] claim failed", error.code, error.message);
    return;
  }
  const notices = (data ?? []) as unknown as SaleNotice[];

  for (const notice of notices) {
    const failure = notice.creator_email ? await sendEmail(apiKey, notice) : "Creator sem e-mail.";
    if (failure) {
      console.error("[sale notifications] send failed", { id: notice.id, failure });
    }
    await client.db.rpc("finish_sale_notification", {
      ...auth,
      p_id: notice.id,
      p_status: failure ? (notice.creator_email ? "failed" : "skipped") : "sent",
      p_error: failure,
    });
  }
}
