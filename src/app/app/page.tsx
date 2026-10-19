import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  MapPin,
  Send,
  UserPlus,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/ui/panel";
import { StatCard } from "@/components/ui/stat-card";
import { RingIcon } from "@/components/ui/ring-icon";
import { SparkArea } from "@/components/charts/spark-area";
import { RankBars } from "@/components/charts/rank-bars";
import { FunnelBars } from "@/components/charts/funnel-bars";
import { ApplicationStatusBadge } from "@/features/applications/status-badge";
import { formatDate } from "@/features/creators/format";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { getOnboardingState } from "@/features/onboarding/queries";
import { OnboardingChecklist } from "@/features/onboarding/components/onboarding-checklist";
import {
  getDashboardOverview,
  type DashboardPeriodDays,
} from "@/features/dashboard/queries";
import { APPROVED_WITHOUT_ADDRESS_HREF } from "@/features/dashboard/aggregate";

export const metadata: Metadata = { title: "Visão Geral" };

const PERIODS: { days: DashboardPeriodDays; label: string }[] = [
  { days: 7, label: "7 dias" },
  { days: 30, label: "30 dias" },
  { days: 90, label: "90 dias" },
];

function parsePeriod(v: string | string[] | undefined): DashboardPeriodDays {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return n === 7 || n === 90 ? n : 30;
}

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const period = parsePeriod((await searchParams).period);
  const [current, data, onboarding] = await Promise.all([
    getCurrentOrganization(),
    getDashboardOverview(period),
    getOnboardingState(),
  ]);
  if (!current || !data) return null;

  const periodLabel =
    PERIODS.find((p) => p.days === period)?.label ?? `${period} dias`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 pb-4">
        <PageHeader
          title="Visão Geral"
          description={`${current.organization.name} · painel operacional`}
        />
        <div className="flex items-center gap-0.5 rounded-full bg-muted p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.days}
              href={p.days === 30 ? "/app" : `/app?period=${p.days}`}
              scroll={false}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[0.8125rem] transition-colors",
                p.days === period
                  ? "bg-card font-medium text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {onboarding ? <OnboardingChecklist state={onboarding} /> : null}

      {/* Hero: new creators (ink) + the four operating figures */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <section className="flex min-h-72 flex-col rounded-[28px] bg-ink p-6 text-ink-foreground">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm">Novos creators</p>
              <p className="mt-1 text-[0.8125rem] text-ink-muted">
                últimos {periodLabel}
              </p>
            </div>
            <RingIcon icon={UserPlus} size={38} variant="disc" />
          </div>
          <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-8">
            <span className="figure text-[4.5rem] text-primary-on-ink">
              {data.newCreators.toLocaleString("pt-BR")}
            </span>
            {data.growthRatePct != null ? (
              <span
                className={cn(
                  "mb-2 rounded-full border-2 border-ink-foreground px-3 py-0.5 text-[0.8125rem] tabular-nums",
                  data.growthRatePct > 0 && "bg-primary text-primary-foreground",
                )}
              >
                {data.growthRatePct > 0 ? "+" : ""}
                {data.growthRatePct}%
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-[0.8125rem] text-ink-muted">
            {data.newCreatorsPrev.toLocaleString("pt-BR")} no período anterior
          </p>
        </section>

        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Total de creators"
            value={data.totalCreators.toLocaleString("pt-BR")}
            href="/app/creators"
            icon={Users}
          />
          <StatCard
            label="Aprovadas"
            value={data.approved.toLocaleString("pt-BR")}
            href="/app/creators?status=approved"
            icon={CheckCircle2}
          />
          <StatCard
            label="Aprovadas sem endereço"
            value={data.approvedWithoutAddress.toLocaleString("pt-BR")}
            href={APPROVED_WITHOUT_ADDRESS_HREF}
            icon={MapPin}
          />
          <StatCard
            label="Envios ativos"
            value={data.activeShipments.toLocaleString("pt-BR")}
            href="/app/shipments"
            icon={Send}
            hint="rascunho, preparando ou enviado"
          />
        </div>
      </div>

      {/* Growth (ink) + funnel */}
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel
          tone="ink"
          title="Crescimento da base"
          description={`Creators acumuladas · últimos ${periodLabel}`}
        >
          <SparkArea
            values={data.growth.map((g) => g.total)}
            height={150}
            className="text-primary-on-ink"
          />
          <div className="mt-4 flex items-center justify-between gap-3 text-[0.8125rem] text-ink-muted">
            <span>
              {data.growth.length > 0 ? formatDate(data.growth[0].date) : ""}
            </span>
            <span className="rounded-full bg-primary px-3 py-0.5 tabular-nums text-primary-foreground">
              +{data.growth.reduce((s, g) => s + g.added, 0)} no período
            </span>
            <span>
              {data.growth.length > 0
                ? formatDate(data.growth[data.growth.length - 1].date)
                : ""}
            </span>
          </div>
        </Panel>

        <Panel title="Funil de inscrições">
          <FunnelBars stages={data.funnel} />
        </Panel>
      </div>

      {/* Attention */}
      {data.attention.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.attention.map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="flex items-center gap-3 rounded-full bg-card py-2 pr-2 pl-2 transition-shadow hover:shadow-sm"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-[1.05rem] font-medium tabular-nums text-primary-foreground">
                {a.count}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {a.label}
              </span>
              <RingIcon icon={ArrowUpRight} size={32} />
            </Link>
          ))}
        </div>
      ) : null}

      {/* Distribution */}
      <div className="grid gap-4 md:grid-cols-3">
        <Panel title="Top cidades">
          <RankBars
            rows={data.topCities}
            emptyLabel="Nenhuma cidade informada ainda."
          />
        </Panel>
        <Panel title="Top estados">
          <RankBars
            rows={data.topStates}
            emptyLabel="Nenhum estado informado ainda."
          />
        </Panel>
        <Panel title="Programas com mais creators">
          <RankBars
            rows={data.topPrograms}
            emptyLabel="Nenhuma inscrição por programa ainda."
          />
        </Panel>
      </div>

      {/* Latest */}
      <Panel
        title="Últimas inscrições"
        action={{ label: "Ver todas", href: "/app/creators" }}
        bodyClassName="px-5 pt-2 pb-2 sm:px-6"
      >
        {data.latest.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma inscrição ainda.
          </p>
        ) : (
          <ul>
            {data.latest.map((a, i) => (
              <li key={a.id} className={cn(i > 0 && "border-t border-border")}>
                <Link
                  href={`/app/creators?a=${a.id}`}
                  className="-mx-2 flex items-center gap-4 rounded-2xl px-2 py-3 transition-colors hover:bg-accent"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-[0.8rem] font-medium">
                    {initials(a.creator_name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] font-medium">
                      {a.creator_name}
                    </p>
                    <p className="truncate text-[0.8125rem] text-muted-foreground">
                      {a.program_name} · {formatDate(a.submitted_at)}
                    </p>
                  </div>
                  <ApplicationStatusBadge status={a.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {data.capped ? (
        <p className="text-center text-[0.75rem] text-faint">
          Distribuições calculadas sobre as 5.000 inscrições mais recentes.
        </p>
      ) : null}
    </div>
  );
}

function initials(name: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}
