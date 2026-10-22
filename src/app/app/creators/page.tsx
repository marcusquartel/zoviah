import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { parseCreatorQuery, serializeCreatorQuery } from "@/lib/query-state";
import { listPrograms } from "@/features/programs/queries";
import {
  getCrmCounts,
  listApplicationItems,
} from "@/features/creators/queries";
import { CreatorsToolbar } from "@/features/creators/components/creators-toolbar";
import { AddCreatorButton } from "@/features/creators/components/add-creator-button";
import { CrmCounters } from "@/features/creators/components/crm-counters";
import { CreatorsResults } from "@/features/creators/components/creators-results";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { getTiers } from "@/features/tiers/queries";

export const metadata: Metadata = { title: "Creators" };

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseCreatorQuery(await searchParams);

  const current = await getCurrentOrganization();
  const [counts, programs, firstPage, tiers] = await Promise.all([
    getCrmCounts(query.program),
    listPrograms(),
    listApplicationItems(
      query,
      query.view === "kanban" ? { pageSize: 200 } : {},
    ),
    current ? getTiers(current.organization.id) : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Creators"
          description="Cada linha é uma inscrição (application) com a creator dela. Uma creator pode ter várias inscrições."
        />
        <AddCreatorButton programs={programs} />
      </div>

      <CreatorsToolbar
        query={query}
        programs={programs.map((p) => ({ id: p.id, name: p.name }))}
        tiers={tiers.map((t) => ({ id: t.id, name: t.name }))}
      />

      <CrmCounters counts={counts} />

      <CreatorsResults
        key={serializeCreatorQuery(query)}
        view={query.view}
        query={query}
        firstPage={firstPage}
      />
    </div>
  );
}
