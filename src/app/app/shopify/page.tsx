import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, ShoppingBag, Store, Tag, Webhook } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/ui/panel";
import { StatCard } from "@/components/ui/stat-card";
import { RingIcon } from "@/components/ui/ring-icon";
import { Badge } from "@/components/ui/badge";
import { getCurrentOrganization } from "@/features/organizations/queries";
import {
  getOrderStats,
  getRecentOrders,
  getShopifyStatus,
  isSyncStale,
} from "@/features/shopify/queries";
import { scheduleAutoSync } from "@/features/shopify/actions";
import { ConnectForm } from "@/features/shopify/components/connect-form";
import { ConnectionActions } from "@/features/shopify/components/connection-actions";
import { formatDate, formatDateTime } from "@/features/creators/format";
import { formatMoney } from "@/lib/money";
import { isSecretBoxConfigured } from "@/lib/crypto/secret-box";

export const metadata: Metadata = { title: "Shopify" };

const ATTRIBUTION_LABEL = { coupon: "Cupom", utm_last: "UTM", utm_first: "UTM (1ª visita)" } as const;

export default async function ShopifyPage() {
  const current = await getCurrentOrganization();
  if (!current) return null;
  const orgId = current.organization.id;
  const canManage = current.role !== "analyst";
  const status = await getShopifyStatus(orgId);

  if (!status) {
    return (
      <div className="space-y-4">
        <div className="pb-4">
          <PageHeader title="Shopify" description="Vendas por cupom e UTM das suas creators." />
        </div>
        {!isSecretBoxConfigured() ? (
          <p className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
            A integração não está disponível neste ambiente (chave de criptografia ausente).
          </p>
        ) : canManage ? (
          <ConnectForm />
        ) : (
          <Panel title="Loja não conectada">
            <p className="text-sm text-muted-foreground">
              Peça para um owner ou admin conectar a loja Shopify.
            </p>
          </Panel>
        )}
      </div>
    );
  }

  if (isSyncStale(status)) await scheduleAutoSync(orgId);

  const [orders, stats] = await Promise.all([getRecentOrders(50), getOrderStats(orgId, 60)]);
  const scopes = (status.scopes ?? "").split(",").map((s) => s.trim());
  const missing = ["read_orders", "write_discounts"].filter((s) => !scopes.includes(s));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
        <PageHeader title="Shopify" description="Vendas por cupom e UTM das suas creators." />
        <ConnectionActions canManage={canManage} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <section className="flex flex-col rounded-[28px] bg-ink p-6 text-ink-foreground">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm">Loja conectada</p>
              <p className="mt-1 truncate text-[0.8125rem] text-ink-muted">{status.shop_domain}</p>
            </div>
            <RingIcon icon={Store} size={38} variant="disc" />
          </div>
          <ul className="mt-auto space-y-2.5 pt-8 text-sm">
            <li className="flex items-center gap-2.5">
              {status.status === "connected" ? (
                <CheckCircle2 className="size-4 text-primary-on-ink" />
              ) : (
                <AlertTriangle className="size-4 text-warning" />
              )}
              {status.last_sync_at
                ? `Última sincronização ${formatDateTime(status.last_sync_at)}`
                : "Primeira sincronização em andamento…"}
            </li>
            <li className="flex items-center gap-2.5">
              <Webhook className="size-4 text-ink-muted" />
              {status.webhooks_ok ? "Pedidos novos chegam em tempo real" : "Webhooks pendentes — sincronize de novo"}
            </li>
          </ul>
          {status.last_error ? (
            <p className="mt-4 rounded-2xl bg-white/10 px-3.5 py-2.5 text-[0.8125rem]">{status.last_error}</p>
          ) : null}
          {missing.length ? (
            <p className="mt-4 rounded-2xl bg-white/10 px-3.5 py-2.5 text-[0.8125rem]">
              Faltam escopos no app: {missing.join(", ")}. Libere uma nova versão e aprove na loja.
            </p>
          ) : null}
        </section>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard label="Pedidos" hint="últimos 60 dias" value={stats.orders.toLocaleString("pt-BR")} icon={ShoppingBag} />
          <StatCard label="Atribuídos" hint="a uma creator" value={stats.attributedOrders.toLocaleString("pt-BR")} icon={Tag} />
          <StatCard
            label="Vendas atribuídas"
            hint="sem frete e impostos"
            value={formatMoney(stats.attributedSales)}
            href="/app/commissions"
            className="col-span-2 sm:col-span-1"
          />
        </div>
      </div>

      <Panel title="Pedidos recentes" description="Os 50 mais recentes sincronizados da loja." bodyClassName="px-0 pt-2 pb-2">
        {orders.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            Nenhum pedido importado ainda.
          </p>
        ) : (
          <div className="overflow-x-auto px-3 sm:px-4">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-[0.8125rem] text-faint">
                  <th className="px-3 py-3 font-normal">Pedido</th>
                  <th className="px-3 py-3 font-normal">Data</th>
                  <th className="px-3 py-3 font-normal">Valor</th>
                  <th className="px-3 py-3 font-normal">Cupons</th>
                  <th className="px-3 py-3 font-normal">UTM</th>
                  <th className="px-3 py-3 font-normal">Creator</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const utm = o.utm_last ?? o.utm_first;
                  return (
                    <tr key={o.id} className="border-t border-border">
                      <td className="px-3 py-3.5">
                        <span className="font-medium">{o.name ?? "—"}</span>
                        {o.cancelled_at ? (
                          <Badge variant="outline" className="ml-2">Cancelado</Badge>
                        ) : o.test ? (
                          <Badge variant="outline" className="ml-2">Teste</Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-3.5 text-muted-foreground">{formatDate(o.processed_at)}</td>
                      <td className="px-3 py-3.5 tabular-nums">{formatMoney(o.subtotal, o.currency)}</td>
                      <td className="px-3 py-3.5">
                        {o.discount_codes.length ? (
                          <span className="flex flex-wrap gap-1">
                            {o.discount_codes.map((c) => (
                              <Badge key={c} variant="secondary">{c}</Badge>
                            ))}
                          </span>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-3.5 text-muted-foreground">
                        {utm ? [utm.source, utm.campaign, utm.content].filter(Boolean).join(" · ") || "—" : "—"}
                      </td>
                      <td className="px-3 py-3.5">
                        {o.creator_name ? (
                          <span className="flex items-center gap-2">
                            <span className="truncate">{o.creator_name}</span>
                            {o.attribution ? (
                              <Badge variant="secondary">{ATTRIBUTION_LABEL[o.attribution]}</Badge>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-faint">Não atribuído</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
