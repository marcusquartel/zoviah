/**
 * Minimal Resend client (SERVER ONLY). One place for the sender identity:
 * "<Brand> via Zoviah" <avisos@auth.zoviah.app> (SALE_EMAIL_FROM overrides
 * the address).
 */
const DEFAULT_FROM_ADDRESS = "avisos@auth.zoviah.app";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function fromHeader(brandName: string): string {
  const address = process.env.SALE_EMAIL_FROM?.trim() || DEFAULT_FROM_ADDRESS;
  // Display names can't carry quotes / angle brackets unescaped.
  const name = `${brandName} via Zoviah`.replace(/["<>]/g, "");
  return `"${name}" <${address}>`;
}

/** Returns null on success, else a short error (never includes the API key). */
export async function sendEmail(input: {
  brandName: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Same key retried → Resend sends once. */
  idempotencyKey?: string;
}): Promise<string | null> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return "Envio de e-mail não configurado (RESEND_API_KEY).";
  let res: Response;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: fromHeader(input.brandName),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
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
