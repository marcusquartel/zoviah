/**
 * Sends the queued "nova venda" e-mails for one organization (SERVER ONLY).
 * Called after a Shopify webhook / sync has ingested orders. The queue rows
 * are filled by a DB trigger; here we only claim, send through Resend and
 * record the outcome. Without RESEND_API_KEY nothing is claimed, so the
 * notices simply wait.
 */
import type { ShopifyClient } from "@/lib/shopify/client";
import { buildSaleEmail, type SaleNotice } from "@/lib/notifications/sale-email";
import { isEmailConfigured, sendEmail } from "@/lib/notifications/resend";

export async function deliverSaleNotifications(client: ShopifyClient): Promise<void> {
  if (!isEmailConfigured()) return;

  const auth = { p_org: client.organizationId, p_ingest_key: client.ingestKey };
  const { data, error } = await client.db.rpc("claim_sale_notifications", { ...auth, p_limit: 20 });
  if (error) {
    console.error("[sale notifications] claim failed", error.code, error.message);
    return;
  }
  const notices = (data ?? []) as unknown as SaleNotice[];

  for (const notice of notices) {
    let failure: string | null = "Creator sem e-mail.";
    if (notice.creator_email) {
      const mail = buildSaleEmail(notice);
      failure = await sendEmail({
        brandName: notice.organization_name,
        to: notice.creator_email,
        ...mail,
        idempotencyKey: `sale-notice-${notice.id}`,
      });
    }
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
