import { Flame, Lock, Ticket, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMoney, formatPercent } from "@/lib/money";
import { formatDate } from "@/features/creators/format";
import { computeAchievements, nextAchievement, type Achievement } from "@/lib/portal/achievements";
import { CopyCode } from "@/features/portal/components/copy-code";
import { RankingTabs } from "@/features/portal/components/ranking";
import { CreatorAvatar } from "@/features/portal/components/avatar-upload";
import type { PortalCommissionStatus, PortalDashboard, PortalRankingRow } from "@/features/portal/types";
import { cn } from "@/lib/utils";

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
  const m = Number(new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date(iso)));
  return MONTHS[m - 1] ?? "";
}

const FALLBACK_PRIMARY = "#26262d";
const FALLBACK_SECONDARY = "#8a8a99";

/** "Patrícia Gonçalves da Silva" → "Patrícia Gonçalves" (podium labels). */
function shortName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.length <= 2 ? name : `${parts[0]} ${parts[1]}`;
}

export function PortalDashboardView({
  data,
  creatorId,
  canEditAvatar,
}: {
  data: PortalDashboard;
  creatorId: string;
  canEditAvatar: boolean;
}) {
  const primary = data.branding.primary_color || FALLBACK_PRIMARY;
  const secondary = data.branding.secondary_color || primary || FALLBACK_SECONDARY;
  const gradient = `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;
  // Same gradient under a dark veil: white text stays readable on light brand
  // colors (e.g. Rare Way's pink).
  const textGradient = `linear-gradient(rgba(0,0,0,.22), rgba(0,0,0,.22)), ${gradient}`;

  const me = data.ranking.all.find((r) => r.me) ?? null;
  const meTier = data.ranking.tier?.find((r) => r.me) ?? null;
  const month = monthLabel(data.month.from);
  const achievements = computeAchievements({
    monthOrders: Number(data.month.orders),
    monthSales: Number(data.month.sales),
    totalOrders: Number(data.totals.orders),
    position: me && Number(data.month.orders) > 0 ? me.position : null,
    streakMonths: data.streak_months,
  });
  const next = nextAchievement(achievements);
  const unlocked = achievements.filter((a) => a.unlocked).length;

  return (
    <div className="space-y-5">
      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden rounded-3xl p-5 text-white shadow-sm sm:p-7" style={{ background: textGradient }}>
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-white/15 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <CreatorAvatar
            creatorId={creatorId}
            name={data.creator.full_name}
            url={data.creator.avatar_url}
            editable={canEditAvatar}
            gradient={gradient}
            className="size-24 shrink-0 text-[0.9rem] ring-4 ring-white/70 sm:size-28"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-white/85">{data.organization.name}</p>
            <h1 className="text-2xl font-bold drop-shadow-sm sm:text-3xl">Oi, {data.creator.name}!</h1>
            <div className="mt-2 flex flex-wrap gap-2 text-sm">
              {data.tier ? <Pill>⭐ {data.tier.name}</Pill> : null}
              {me && Number(data.month.orders) > 0 ? <Pill>🏆 {me.position}º no ranking</Pill> : null}
              {data.streak_months > 0 ? (
                <Pill>
                  <Flame className="size-3.5" /> {data.streak_months} {data.streak_months === 1 ? "mês" : "meses"} vendendo
                </Pill>
              ) : null}
              <Pill>🎖️ {unlocked}/{achievements.length} conquistas</Pill>
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-sm text-white/85">Vendido em {month}</p>
            <p className="text-3xl font-bold tabular-nums drop-shadow-sm sm:text-4xl">{formatMoney(data.month.sales)}</p>
            <p className="text-sm text-white/85">
              {data.month.orders} {Number(data.month.orders) === 1 ? "venda" : "vendas"} · {formatMoney(data.month.commission)} de comissão
            </p>
          </div>
        </div>

        {next ? (
          <div className="relative mt-5 rounded-2xl bg-white/15 p-3 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium">
                Próxima conquista: {next.emoji} {next.title}
              </span>
              <span className="shrink-0 text-white/85">{next.remaining}</span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white" style={{ width: `${Math.max(4, Math.round(next.progress * 100))}%` }} />
            </div>
          </div>
        ) : null}
      </section>

      {/* ----------------------------------------------------------- stats */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat emoji="🛍️" label={`Vendas em ${month}`} value={String(data.month.orders)} />
        <Stat emoji="💰" label="Comissão do mês" value={formatMoney(data.month.commission)} />
        <Stat emoji="🎯" label="Sua comissão" value={data.commission_rate != null ? formatPercent(data.commission_rate) : "—"} />
        <Stat emoji="📈" label="Total vendido" value={formatMoney(data.totals.sales)} hint={`${data.totals.orders} vendas desde o início`} />
      </section>

      {/* ------------------------------------------------- podium + coupons */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <div className="flex items-center gap-2">
              <Trophy className="size-4" style={{ color: primary }} />
              <p className="font-semibold">Pódio de {month}</p>
            </div>
            <div className="flex gap-3 text-sm text-muted-foreground">
              <span>
                Geral: <b className="text-foreground">{me ? `${me.position}º` : "—"}</b>/{data.ranking.all.length}
              </span>
              {data.ranking.tier && data.tier ? (
                <span>
                  {data.tier.name}: <b className="text-foreground">{meTier ? `${meTier.position}º` : "—"}</b>/{data.ranking.tier.length}
                </span>
              ) : null}
            </div>
          </div>
          <Podium rows={data.ranking.all} primary={primary} secondary={secondary} />
          <p className="mt-3 text-center text-sm text-muted-foreground">
            {me && me.position <= 3 && Number(data.month.orders) > 0
              ? "Você está no pódio! Continue divulgando para se manter lá. 🎉"
              : Number(data.month.orders) > 0
                ? "Cada venda conta: continue divulgando para subir no ranking!"
                : "Faça sua primeira venda do mês para entrar no ranking!"}
          </p>
        </Card>

        <Card>
          <div className="flex items-center gap-2">
            <Ticket className="size-4" style={{ color: primary }} />
            <p className="font-semibold">Seus cupons</p>
          </div>
          <div className="mt-3 space-y-3">
            {data.coupons.affiliate ? (
              <CouponTicket
                title="Para divulgar"
                hint="Suas seguidoras ganham desconto e você ganha comissão."
                code={data.coupons.affiliate.code}
                discount={data.coupons.affiliate.discount_percent}
                color={primary}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Seu cupom de divulgação ainda não foi cadastrado.</p>
            )}
            {data.coupons.personal ? (
              <CouponTicket
                title="Só seu"
                hint="Desconto exclusivo para as suas compras."
                code={data.coupons.personal.code}
                discount={data.coupons.personal.discount_percent}
                color={secondary}
              />
            ) : null}
          </div>
        </Card>
      </section>

      {/* ---------------------------------------------------- achievements */}
      <Card>
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">Conquistas</p>
          <span className="text-sm text-muted-foreground">
            {unlocked} de {achievements.length}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {achievements.map((a) => (
            <AchievementCard key={a.id} a={a} gradient={textGradient} />
          ))}
        </div>
      </Card>

      {/* --------------------------------------------------------- ranking */}
      <Card>
        <p className="font-semibold">Ranking de {month}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pelo valor vendido no mês. Os valores das outras creators não são exibidos.
        </p>
        <div className="mt-3">
          <RankingTabs all={data.ranking.all} tier={data.ranking.tier} tierName={data.tier?.name ?? null} accent={primary} />
        </div>
      </Card>

      {/* ----------------------------------------------------- commissions */}
      <Card>
        <p className="font-semibold">Suas comissões</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniStat label="Aguardando pagamento do pedido" value={formatMoney(data.commissions.awaiting_payment)} />
          <MiniStat label="Em carência" value={formatMoney(data.commissions.in_hold)} />
          <MiniStat label="A receber" value={formatMoney(data.commissions.available)} accent={textGradient} />
          <MiniStat label="Já recebidas" value={formatMoney(data.commissions.paid)} />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          A comissão fica em carência por um período após a compra, para cobrir trocas e devoluções.
          Depois disso ela fica disponível para pagamento.
        </p>
      </Card>

      {/* ---------------------------------------------------------- orders */}
      <Card>
        <p className="font-semibold">Suas últimas vendas</p>
        {data.recent_orders.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma venda ainda. Divulgue seu cupom! ✨</p>
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

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 font-medium backdrop-blur-sm">
      {children}
    </span>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border bg-card p-4 shadow-xs sm:p-5">{children}</div>;
}

function Stat({ emoji, label, value, hint }: { emoji: string; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-xs">
      <p className="text-xs text-muted-foreground">
        <span aria-hidden>{emoji}</span> {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div
      className={cn("rounded-xl p-3", accent ? "text-white" : "bg-muted/50")}
      style={accent ? { background: accent } : undefined}
    >
      <p className={cn("text-xs", accent ? "text-white/85" : "text-muted-foreground")}>{label}</p>
      <p className="mt-0.5 font-bold tabular-nums">{value}</p>
    </div>
  );
}

const PODIUM = [
  { place: 2, medal: "🥈", height: "h-20" },
  { place: 1, medal: "🥇", height: "h-28" },
  { place: 3, medal: "🥉", height: "h-14" },
] as const;

function Podium({ rows, primary, secondary }: { rows: PortalRankingRow[]; primary: string; secondary: string }) {
  // Only creators with sales this month stand on the podium.
  const ranked = rows.filter((r) => r.active).slice(0, 3);
  const byPlace = (n: number) => ranked[n - 1] ?? null;
  return (
    <div className="mt-4 grid grid-cols-3 items-end gap-2">
      {PODIUM.map(({ place, medal, height }) => {
        const r = byPlace(place);
        return (
          <div key={place} className="flex min-w-0 flex-col items-center gap-1.5 text-center">
            <span className="text-3xl" aria-hidden>
              {medal}
            </span>
            <span
              className={cn("w-full truncate text-xs font-medium sm:text-sm", r?.me && "font-bold")}
              style={r?.me ? { color: primary } : undefined}
            >
              {r ? (r.me ? "Você!" : shortName(r.name)) : "—"}
            </span>
            {r?.tier ? <span className="text-[0.7rem] text-muted-foreground">{r.tier}</span> : null}
            <div
              className={cn("flex w-full items-start justify-center rounded-t-xl pt-2 text-lg font-bold text-white", height)}
              style={{
                background: `linear-gradient(180deg, ${place === 1 ? primary : secondary} 0%, ${place === 1 ? secondary : primary} 100%)`,
                opacity: place === 1 ? 1 : 0.8,
              }}
            >
              {place}º
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CouponTicket({
  title,
  hint,
  code,
  discount,
  color,
}: {
  title: string;
  hint: string;
  code: string;
  discount: number | null;
  color: string;
}) {
  return (
    <div className="relative flex items-center gap-3 rounded-xl border-2 border-dashed p-3" style={{ borderColor: color }}>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium" style={{ color }}>
          {title}
          {discount != null ? ` · ${formatPercent(discount)} OFF` : ""}
        </p>
        <p className="font-mono text-lg font-bold tracking-wide">{code}</p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <CopyCode code={code} />
    </div>
  );
}

function AchievementCard({ a, gradient }: { a: Achievement; gradient: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-2xl p-3 text-center",
        a.unlocked ? "text-white shadow-sm" : "border bg-muted/30",
      )}
      style={a.unlocked ? { background: gradient } : undefined}
      title={a.description}
    >
      <span className={cn("text-3xl", !a.unlocked && "opacity-40 grayscale")} aria-hidden>
        {a.emoji}
      </span>
      <p className={cn("text-sm font-semibold", !a.unlocked && "text-muted-foreground")}>{a.title}</p>
      <p className={cn("text-[0.7rem] leading-tight", a.unlocked ? "text-white/90" : "text-muted-foreground")}>
        {a.unlocked ? a.description : (a.remaining ?? a.description)}
      </p>
      {!a.unlocked && a.remaining ? (
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-foreground/40" style={{ width: `${Math.round(a.progress * 100)}%` }} />
        </div>
      ) : null}
      {!a.unlocked && !a.remaining ? <Lock className="size-3 text-muted-foreground" aria-label="Bloqueada" /> : null}
    </div>
  );
}
