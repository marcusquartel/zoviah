import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ApplicationStatusBadge } from "@/features/applications/status-badge";
import { formatDate } from "@/features/creators/format";
import { getOverviewStats } from "@/features/creators/queries";
import { getCurrentOrganization } from "@/features/organizations/queries";

export const metadata: Metadata = { title: "Visão Geral · Creator Hub" };

export default async function OverviewPage() {
  const [current, stats] = await Promise.all([
    getCurrentOrganization(),
    getOverviewStats(),
  ]);
  if (!current || !stats) return null;

  const metrics = [
    { label: "Creators cadastradas", value: stats.creators },
    { label: "Inscrições totais", value: stats.applications },
    { label: "Novas", value: stats.new },
    { label: "Aprovadas", value: stats.approved },
    { label: "Programas ativos", value: stats.activePrograms },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão Geral"
        description={`${current.organization.name} · painel operacional`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border bg-card px-4 py-3">
            <p className="text-2xl font-semibold tabular-nums">{m.value}</p>
            <p className="text-xs text-muted-foreground">{m.label}</p>
          </div>
        ))}
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Últimas inscrições</h2>
          <Link
            href="/app/creators"
            className="text-sm text-primary hover:underline"
          >
            Ver todas
          </Link>
        </div>

        {stats.latest.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-surface p-6 text-center text-sm text-muted-foreground">
            Nenhuma inscrição ainda.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {stats.latest.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.creator_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {a.program_name} · {formatDate(a.submitted_at)}
                  </p>
                </div>
                <ApplicationStatusBadge status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
