import { Medal, Ticket, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatPercent } from "@/lib/money";
import { formatDate } from "@/features/creators/format";
import { CopyCode } from "@/features/portal/components/copy-code";
import { RankingTabs } from "@/features/portal/components/ranking";
import type { PortalCommissionStatus, PortalDashboard } from "@/features/portal/types";

const COMMISSION_STATUS: Record<PortalCommissionStatus, string> = {
  awaiting_payment: "Aguardando pagamento",
  in_hold: "Em carência",
  available: "A receber",
  paid: "Paga",
  reversed: "Estornada",
};

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function monthLabel(iso: string): string {
  const d = new Date(iso);
  return MONTHS[Number(new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: "America/Sao_Paulo" }).format(d)) - 1] ?? "";
}

export function PortalDashboardView({ data }: { data: PortalDashboard }) {
  const me = data.ranking.all.find((r) => r.me) ?? null;
  const meTier = data.ranking.tier?.find((r) => r.me) ?? null;
  const month = monthLabel(data.month.from);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold">Oi, {data.creator.name}!</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seu desempenho em {month}
          {data.tier ? (
            <>
              {" "}· categoria <b className="text-foreground">{data.tier.name}</b>
            </>
          ) : null}
          {data.commission_rate != null ? ` · comissão de ${formatPercent(data.commission_rate)}` : null}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label={`Vendas em ${month}`} value={String(data.month.orders)} />
        <Stat label="Valor vendido" value={formatMoney(data.month.sales)} />
        <Stat label="Sua comissão no mês" value={formatMoney(data.month.commission)} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Card>
          <div className="flex items-center gap-2">
            <Trophy className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">Sua posição no ranking</p>
          </div>
          <div className="mt-3 flex gap-6">
            <Position label="Geral" row={me} total={data.ranking.all.length} />
            {data.ranking.tier && data.tier ? (
              <Position label={data.tier.name} row={meTier} total={data.ranking.tier.length} />
            ) : null}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <Ticket className="size-4 text-muted-foreground" />
            <p className="text-sm font-medium">Seus cupons</p>
          </div>
          <div className="mt-3 space-y-3">
            {data.coupons.affiliate ? (
              <CouponRow
                title="Para divulgar"
                hint="Suas seguidoras ganham desconto e você ganha comissão."
                code={data.coupons.affiliate.code}
                discount={data.coupons.affiliate.discount_percent}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Seu cupom de divulgação ainda não foi cadastrado.</p>
            )}
            {data.coupons.personal ? (
              <CouponRow
                title="Uso pessoal"
                hint="Desconto exclusivo para as suas compras."
                code={data.coupons.personal.code}
                discount={data.coupons.personal.discount_percent}
              />
            ) : null}
          </div>
        </Card>
      </section>

      <Card>
        <p className="text-sm font-medium">Suas comissões</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <MiniStat label="Aguardando pagamento do pedido" value={formatMoney(data.commissions.awaiting_payment)} />
          <MiniStat label="Em carência" value={formatMoney(data.commissions.in_hold)} />
          <MiniStat label="A receber" value={formatMoney(data.commissions.available)} strong />
          <MiniStat label="Já recebidas" value={formatMoney(data.commissions.paid)} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          A comissão fica em carência por um período após a compra, para cobrir trocas e
          devoluções. Depois disso ela fica disponível para pagamento.
        </p>
      </Card>

      <Card>
        <div className="flex items-center gap-2">
          <Medal className="size-4 text-muted-foreground" />
          <p className="text-sm font-medium">Ranking de {month}</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Pelo valor vendido no mês. Os valores das outras creators não são exibidos.
        </p>
        <div className="mt-3">
          <RankingTabs all={data.ranking.all} tier={data.ranking.tier} tierName={data.tier?.name ?? null} />
        </div>
      </Card>

      <Card>
        <p className="text-sm font-medium">Suas últimas vendas</p>
        {data.recent_orders.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma venda ainda. Divulgue seu cupom!
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3 font-normal">Pedido</th>
                  <th className="py-2 pr-3 font-normal">Data</th>
                  <th className="py-2 pr-3 text-right font-normal">Valor</th>
                  <th className="py-2 pr-3 text-right font-normal">Comissão</th>
                  <th className="py-2 font-normal">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_orders.map((o, i) => (
                  <tr key={`${o.name}-${i}`} className="border-t">
                    <td className="py-2 pr-3">{o.name ?? "—"}</td>
                    <td className="py-2 pr-3">{formatDate(o.processed_at)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(o.subtotal, o.currency)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {o.commission != null ? formatMoney(o.commission, o.currency) : "—"}
                    </td>
                    <td className="py-2">
                      {o.cancelled ? (
                        <Badge variant="outline">Cancelado</Badge>
                      ) : o.commission_status ? (
                        <Badge variant={o.commission_status === "available" ? "default" : "secondary"}>
                          {COMMISSION_STATUS[o.commission_status]}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border bg-card p-4">{children}</div>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={strong ? "rounded-lg bg-primary/10 p-3" : "rounded-lg bg-muted/50 p-3"}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Position({
  label,
  row,
  total,
}: {
  label: string;
  row: { position: number } | null;
  total: number;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold tabular-nums">
        {row ? `${row.position}º` : "—"}
        <span className="text-sm font-normal text-muted-foreground"> de {total}</span>
      </p>
    </div>
  );
}

function CouponRow({
  title,
  hint,
  code,
  discount,
}: {
  title: string;
  hint: string;
  code: string;
  discount: number | null;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">
          {title}
          {discount != null ? ` · ${formatPercent(discount)} de desconto` : ""}
        </p>
        <p className="font-mono text-base font-semibold">{code}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <CopyCode code={code} />
    </div>
  );
}
