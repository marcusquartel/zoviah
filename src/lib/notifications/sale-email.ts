/**
 * The "nova venda com o seu cupom" e-mail. Pure (no I/O) so it is unit-tested.
 * Carries no customer data — only the order number, its value and her
 * commission.
 */
// Relative (not "@/") so this module stays importable by the node test runner.
import { formatMoney } from "../money.ts";

export interface SaleNotice {
  id: string;
  creator_email: string;
  creator_name: string;
  organization_name: string;
  code: string | null;
  order_name: string | null;
  subtotal: number | string;
  currency: string;
  processed_at: string;
  commission: number | string | null;
  month_orders: number;
  month_commission: number | string;
}

export interface SaleEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildSaleEmail(n: SaleNotice): SaleEmail {
  const value = formatMoney(n.subtotal, n.currency);
  const commission = n.commission != null ? formatMoney(n.commission, n.currency) : null;
  const monthCommission = formatMoney(n.month_commission, n.currency);
  const orders = Number(n.month_orders);
  const coupon = n.code ? ` com o cupom ${n.code}` : "";

  const subject = n.code
    ? `Nova venda com o seu cupom ${n.code}!`
    : `Nova venda atribuída a você!`;

  const lines = [
    `Oi, ${n.creator_name}!`,
    "",
    `Alguém acabou de comprar na ${n.organization_name}${coupon}.`,
    "",
    `Pedido: ${n.order_name ?? "—"}`,
    `Valor: ${value}`,
    ...(commission ? [`Sua comissão: ${commission}`] : []),
    "",
    `Neste mês: ${orders} ${orders === 1 ? "venda" : "vendas"}` +
      (Number(n.month_commission) > 0 ? ` · ${monthCommission} em comissões` : ""),
    "",
    "Continue divulgando!",
    `Equipe ${n.organization_name}`,
  ];

  const e = escapeHtml;
  const row = (label: string, v: string) =>
    `<tr><td style="padding:4px 16px 4px 0;color:#6b6b6b">${e(label)}</td><td style="padding:4px 0;font-weight:600">${e(v)}</td></tr>`;

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f6f4f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1f1f1f">
<div style="max-width:480px;margin:0 auto;padding:32px 20px">
<div style="background:#ffffff;border-radius:16px;padding:28px">
<p style="margin:0 0 4px;font-size:13px;color:#6b6b6b">${e(n.organization_name)}</p>
<h1 style="margin:0 0 16px;font-size:20px">Oi, ${e(n.creator_name)}! Você fez uma venda 🎉</h1>
<p style="margin:0 0 16px;font-size:15px;line-height:1.5">Alguém acabou de comprar${e(coupon)}.</p>
<table style="border-collapse:collapse;font-size:15px;margin:0 0 20px">
${row("Pedido", n.order_name ?? "—")}
${row("Valor", value)}
${commission ? row("Sua comissão", commission) : ""}
</table>
<p style="margin:0;padding:12px 14px;background:#f6f4f0;border-radius:10px;font-size:14px">
Neste mês: <b>${orders} ${orders === 1 ? "venda" : "vendas"}</b>${Number(n.month_commission) > 0 ? ` · <b>${e(monthCommission)}</b> em comissões` : ""}
</p>
<p style="margin:20px 0 0;font-size:15px">Continue divulgando!<br>Equipe ${e(n.organization_name)}</p>
</div>
<p style="margin:16px 0 0;text-align:center;font-size:12px;color:#9a9a9a">Aviso automático enviado pelo Zoviah em nome da ${e(n.organization_name)}.</p>
</div></body></html>`;

  return { subject, html, text: lines.join("\n") };
}
