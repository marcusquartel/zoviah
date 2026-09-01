import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/ui/panel";
import { StatCard } from "@/components/ui/stat-card";
import { SparkArea } from "@/components/charts/spark-area";
import { RankBars } from "@/components/charts/rank-bars";
import { FunnelBars } from "@/components/charts/funnel-bars";
import { ApplicationStatusBadge } from "@/features/applications/status-badge";
import { formatDate } from "@/features/creators/format";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { getOnboardingState } from "@/features/onboarding/queries";
import { OnboardingChecklist } from "@/features/onboarding/components/onboarding-checklist";
import { HelpCenter } from "@/features/support/components/help-center";
import {
  getDashboardOverview,
  type DashboardPeriodDays,
} from "@/features/dashboard/queries";

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
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Visão Geral"
          description={`${current.organization.name} · painel operacional`}
        />
        <div className="flex items-center gap-2">
          <HelpCenter />
        <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5 shadow-xs">
          {PERIODS.map((p) => (
            <Link
              key={p.days}
              href={p.days === 30 ? "/app" : `/app?period=${p.days}`}
              scroll={false}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                p.days === period
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </Link>
          ))}
        </div>
        </div>
      </div>

      {onboarding ? <OnboardingChecklist state={onboarding} /> : null}

      {/* Primary metrics */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Total de creators"
          value={data.totalCreators.toLocaleString("pt-BR")}
          href="/app/creators"
          visual={
            <SparkArea values={data.growth.map((g) => g.total)} height={36} />
          }
        />
        <StatCard
          label={`Novos · ${periodLabel}`}
          value={data.newCreators.toLocaleString("pt-BR")}
          deltaPct={data.growthRatePct}
          hint={`${data.newCreatorsPrev} no período anterior`}
        />
        <StatCard
          label="Aprovadas"
          value={data.approved.toLocaleString("pt-BR")}
          href="/app/creators?status=approved"
        />
        <StatCard
          label="Cadastro completo"
          value={data.completeRegistration.toLocaleString("pt-BR")}
          href="/app/creators?status=completed"
        />
        <StatCard
          label="Envios ativos"
          value={data.activeShipments.toLocaleString("pt-BR")}
          href="/app/shipments"
          hint="rascunho, preparando ou enviado"
        />
      </div>

      {/* Growth + funnel */}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel
          title="Crescimento da base"
          description={`Creators acumuladas · últimos ${periodLabel}`}
        >
          <div className="text-chart-1">
            <SparkArea values={data.growth.map((g) => g.total)} height={120} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {data.growth.length > 0
                ? formatDate(data.growth[0].date)
                : ""}
            </span>
            <span className="tabular-nums">
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
        <Panel title="Pontos de atenção">
          <ul className="grid gap-2 sm:grid-cols-3">
            {data.attention.map((a) => (
              <li key={a.label}>
                <Link
                  href={a.href}
                  className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 transition-colors hover:border-warning/50"
                >
                  <AlertTriangle className="size-4 shrink-0 text-warning" />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {a.label}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {a.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
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
        bodyClassName="p-0"
      >
        {data.latest.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma inscrição ainda.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {data.latest.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/app/creators?a=${a.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{a.creator_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
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
        <p className="text-center text-[0.6875rem] text-muted-foreground/70">
          Distribuições calculadas sobre as 5.000 inscrições mais recentes.
        </p>
      ) : null}
    </div>
  );
}
