import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, Download, Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/ui/panel";
import { StatCard } from "@/components/ui/stat-card";
import { RingIcon } from "@/components/ui/ring-icon";
import { Badge } from "@/components/ui/badge";
import { getCurrentOrganization } from "@/features/organizations/queries";
import {
  getAffiliableCreators,
  getCommissionOverview,
  getShopifyStatus,
  type CommissionUiStatus,
} from "@/features/shopify/queries";
import { AffiliationDialog } from "@/features/commissions/components/affiliation-dialog";
import { PayableTable } from "@/features/commissions/components/payable-table";
import { HoldDaysForm } from "@/features/commissions/components/hold-days-form";
import { SaleNotificationsToggle } from "@/features/commissions/components/sale-notifications-toggle";
import { formatDate } from "@/features/creators/format";
import { formatMoney, formatPercent } from "@/lib/money";

export const metadata: Metadata = { title: "Comissões" };

const STATUS: Record<CommissionUiStatus, { label: string; variant: "secondary" | "outline" | "default" | "ink" }> = {
  awaiting_payment: { label: "Aguardando pagamento", variant: "outline" },
  pending: { label: "Em carência", variant: "secondary" },
  approved: { label: "A pagar", variant: "default" },
  paid: { label: "Paga", variant: "ink" },
  reversed: { label: "Estornada", variant: "outline" },
};

export default async function CommissionsPage() {
  const current = await getCurrentOrganization();
  if (!current) return null;
  const canManage = current.role !== "analyst";
  const [overview, status, creators] = await Promise.all([
    getCommissionOverview(),
    getShopifyStatus(current.organization.id),
    getAffiliableCreators(),
  ]);
  if (!overview) return null;
  const shopConnected = Boolean(status);
  const linked = new Set(overview.byCreator.filter((c) => c.affiliation).map((c) => c.creator_id));
  const linkable = creators.filter((c) => !linked.has(c.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
        <PageHeader
          title="Comissões"
          description="Vendas atribuídas por cupom ou UTM e o que cada creator tem a receber."
        />
        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {shopConnected ? (
              <Link
                href="/app/commissions/import"
                className="inline-flex h-10 items-center gap-2 rounded-full border-[1.5px] border-input px-4 text-sm font-medium transition-colors hover:bg-accent"
              >
                <Download className="size-4" /> Importar cupons da loja
              </Link>
            ) : null}
            <AffiliationDialog creators={linkable} shopConnected={shopConnected} />
          </div>
        ) : null}
      </div>

      {!shopConnected ? (
        <Link
          href="/app/shopify"
          className="flex items-center gap-3 rounded-full bg-card py-2 pr-2 pl-5 text-sm transition-shadow hover:shadow-sm"
        >
          <span className="flex-1">Conecte a loja Shopify para importar as vendas das creators.</span>
          <span className="rounded-full bg-primary px-4 py-2 font-medium text-primary-foreground">Conectar</span>
        </Link>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <section className="flex min-h-64 flex-col rounded-[28px] bg-ink p-6 text-ink-foreground">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm">A pagar agora</p>
              <p className="mt-1 text-[0.8125rem] text-ink-muted">
                liberadas após {overview.holdDays} dias sem estorno
              </p>
            </div>
            <RingIcon icon={Wallet} size={38} variant="disc" />
          </div>
          <span className="figure mt-auto pt-8 text-[3.5rem] text-primary-on-ink">
            {formatMoney(overview.totals.approved)}
          </span>
          <p className="mt-3 text-[0.8125rem] text-ink-muted">
            {overview.payable.length} comissão(ões) prontas para pagamento
          </p>
        </section>
        <div className="grid grid-cols-2 gap-4">
          <StatCard label="Em carência" hint="aguardando o prazo" value={formatMoney(overview.totals.pending)} icon={Clock} />
          <StatCard label="Pagas" hint="total histórico" value={formatMoney(overview.totals.paid)} icon={CheckCircle2} />
          <StatCard label="Vendas atribuídas" hint="sem frete e impostos" value={formatMoney(overview.totals.sales)} className="col-span-2 sm:col-span-1" />
          <StatCard label="Pedidos atribuídos" value={overview.totals.orders.toLocaleString("pt-BR")} className="col-span-2 sm:col-span-1" />
        </div>
      </div>

      <Panel title="Por creator" description="Código, comissão e resultado de cada creator vinculada." bodyClassName="px-0 pt-2 pb-2">
        {overview.byCreator.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            Nenhuma creator vinculada ainda. Use “Vincular creator” para criar o código e o cupom.
          </p>
        ) : (
          <div className="overflow-x-auto px-3 sm:px-4">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-[0.8125rem] text-faint">
                  <th className="px-3 py-3 font-normal">Creator</th>
                  <th className="px-3 py-3 font-normal">Código</th>
                  <th className="px-3 py-3 text-right font-normal">Comissão</th>
                  <th className="px-3 py-3 text-right font-normal">Pedidos</th>
                  <th className="px-3 py-3 text-right font-normal">Vendas</th>
                  <th className="px-3 py-3 text-right font-normal">Em carência</th>
                  <th className="px-3 py-3 text-right font-normal">A pagar</th>
                  <th className="px-3 py-3 text-right font-normal">Pago</th>
                  <th className="w-10 py-3" />
                </tr>
              </thead>
              <tbody>
                {overview.byCreator.map((c) => (
                  <tr key={c.creator_id} className="border-t border-border">
                    <td className="px-3 py-3.5 font-medium">{c.creator_name}</td>
                    <td className="px-3 py-3.5">
                      {c.affiliation ? (
                        <span className="flex items-center gap-2">
                          <Badge variant="secondary">{c.affiliation.code}</Badge>
                          {c.affiliation.shopify_discount_id ? (
                            <span className="text-[0.75rem] text-faint">
                              cupom {formatPercent(c.affiliation.discount_percent ?? 0)}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5 text-right tabular-nums">
                      {c.effective_rate != null ? formatPercent(c.effective_rate) : c.affiliation ? "A definir" : "—"}
                      {c.tier_name ? (
                        <span className="block text-[0.75rem] text-faint">
                          {c.affiliation?.commission_rate != null ? "individual" : c.tier_name}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3.5 text-right tabular-nums">{c.orders}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums">{formatMoney(c.sales)}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-muted-foreground">{formatMoney(c.pending)}</td>
                    <td className="px-3 py-3.5 text-right font-medium tabular-nums">{formatMoney(c.approved)}</td>
                    <td className="px-3 py-3.5 text-right tabular-nums text-muted-foreground">{formatMoney(c.paid)}</td>
                    <td className="py-3.5 pr-2 text-right">
                      {canManage ? (
                        <AffiliationDialog
                          creator={{ id: c.creator_id, name: c.creator_name, affiliation: c.affiliation }}
                          shopConnected={shopConnected}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="A pagar" description="Comissões que passaram do prazo de carência sem estorno.">
        <PayableTable
          canPay={canManage}
          rows={overview.payable.map((r) => ({
            id: r.id,
            creator_name: r.creator_name,
            code: r.code,
            order_name: r.order_name,
            processed_at: r.processed_at,
            base_amount: r.base_amount,
            rate: r.rate,
            amount: r.amount,
          }))}
        />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Movimentações recentes" bodyClassName="px-0 pt-2 pb-2">
          {overview.recent.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">Nenhuma comissão ainda.</p>
          ) : (
            <ul className="px-5 sm:px-6">
              {overview.recent.map((r, i) => (
                <li key={r.id} className={`flex items-center gap-4 py-3 ${i ? "border-t border-border" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-medium">
                      {r.creator_name} <span className="font-normal text-faint">· {r.order_name ?? "pedido"}</span>
                    </p>
                    <p className="text-[0.8125rem] text-muted-foreground">
                      {formatDate(r.processed_at)} · {formatPercent(r.rate)} de {formatMoney(r.base_amount)}
                      {r.ui_status === "pending" ? ` · libera em ${formatDate(r.approvable_at)}` : ""}
                    </p>
                  </div>
                  <span className="text-right tabular-nums">{formatMoney(r.amount)}</span>
                  <Badge variant={STATUS[r.ui_status].variant}>{STATUS[r.ui_status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Prazo de carência" description="Tempo para a comissão ser liberada, cobrindo trocas e devoluções.">
          <HoldDaysForm days={overview.holdDays} canEdit={canManage} />
          <p className="mt-4 text-[0.8125rem] leading-relaxed text-faint">
            Pedido cancelado ou reembolsado antes do pagamento estorna a comissão. A comissão é
            calculada sobre o valor dos produtos menos descontos, sem frete nem impostos.
          </p>
        </Panel>
        <Panel title="Avisos de venda" description="E-mail para a creator quando alguém compra com o cupom dela.">
          <SaleNotificationsToggle enabled={overview.saleNotificationsEnabled} canEdit={canManage} />
        </Panel>
      </div>
    </div>
  );
}
