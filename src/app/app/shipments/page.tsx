import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { listPrograms } from "@/features/programs/queries";
import {
  getShipmentCounts,
  listShipments,
  serializeShipmentQuery,
} from "@/features/shipments/queries";
import { parseShipmentQuery } from "@/lib/shipment-query";
import { ShipmentsToolbar } from "@/features/shipments/components/shipments-toolbar";
import { ShipmentCounters } from "@/features/shipments/components/shipment-counters";
import { ShipmentsResults } from "@/features/shipments/components/shipments-results";

export const metadata: Metadata = { title: "Envios · Creator Hub" };

export default async function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = parseShipmentQuery(await searchParams);

  const [counts, programs, firstPage] = await Promise.all([
    getShipmentCounts(query.program),
    listPrograms(),
    listShipments(query, query.view === "kanban" ? { pageSize: 200 } : {}),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Envios"
        description="Gestão operacional de product seeding: o que foi enviado, para onde, quando e se chegou."
      />

      <ShipmentsToolbar
        query={query}
        programs={programs.map((p) => ({ id: p.id, name: p.name }))}
      />

      <ShipmentCounters counts={counts} />

      <ShipmentsResults
        key={serializeShipmentQuery(query)}
        view={query.view}
        query={query}
        firstPage={firstPage}
      />
    </div>
  );
}
