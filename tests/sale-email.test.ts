import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSaleEmail, type SaleNotice } from "../src/lib/notifications/sale-email.ts";

const base: SaleNotice = {
  id: "00000000-0000-0000-0000-000000000001",
  creator_email: "creator@example.com",
  creator_name: "Dayane",
  organization_name: "Rare Way",
  code: "DAYANEPITTA",
  order_name: "#1234",
  subtotal: "285.40",
  currency: "BRL",
  processed_at: "2026-10-22T12:00:00Z",
  commission: "28.54",
  month_orders: 3,
  month_commission: "61.20",
};

test("subject names the coupon", () => {
  assert.equal(buildSaleEmail(base).subject, "Nova venda com o seu cupom DAYANEPITTA!");
});

test("body carries order, value, commission and the month total", () => {
  const { text, html } = buildSaleEmail(base);
  assert.match(text, /Pedido: #1234/);
  assert.match(text, /Valor: R\$\s?285,40/);
  assert.match(text, /Sua comissão: R\$\s?28,54/);
  assert.match(text, /Neste mês: 3 vendas · R\$\s?61,20 em comissões/);
  assert.match(html, /Sua comissão/);
});

test("no commission line when the rate is not defined yet", () => {
  const { text, html } = buildSaleEmail({ ...base, commission: null, month_commission: 0, month_orders: 1 });
  assert.doesNotMatch(text, /comissão/i);
  assert.doesNotMatch(html, /Sua comissão/);
  assert.match(text, /Neste mês: 1 venda$/m);
});

test("names are HTML-escaped", () => {
  const { html } = buildSaleEmail({ ...base, creator_name: "<script>x</script>", organization_name: "A & B" });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /A &amp; B/);
});
