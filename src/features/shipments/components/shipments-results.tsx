"use client";

import { useCallback, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ShipmentTable } from "@/features/shipments/components/shipment-table";
import { ShipmentKanban } from "@/features/shipments/components/shipment-kanban";
import { ShipmentModal } from "@/features/shipments/components/shipment-modal";
import { loadMoreShipments } from "@/features/shipments/actions";
import {
  serializeShipmentQuery,
  type ShipmentQuery,
  type ShipmentView,
} from "@/lib/shipment-query";
import type { ShipmentListItem } from "@/types/database";
import type { ShipmentListPage } from "@/features/shipments/queries";

export function ShipmentsResults({
  view,
  query,
  firstPage,
}: {
  view: ShipmentView;
  query: ShipmentQuery;
  firstPage: ShipmentListPage;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ShipmentListItem[]>(firstPage.items);
  const [page, setPage] = useState(firstPage.page);
  const [hasMore, setHasMore] = useState(firstPage.hasMore);
  const [loadingMore, startLoadMore] = useTransition();

  const selectedId = searchParams.get("s");
  const setSelectedId = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (id) next.set("s", id);
      else next.delete("s");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  const search = serializeShipmentQuery({ ...query, page: 1, view: "list" });

  function refresh() {
    router.refresh();
  }

  function loadMore() {
    startLoadMore(async () => {
      const next = await loadMoreShipments(search, page + 1);
      setItems((prev) => [...prev, ...next.items]);
      setPage(next.page);
      setHasMore(next.hasMore);
    });
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-surface p-10 text-center text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Nenhum envio criado.</p>
          <p className="mt-1">
            Crie um envio a partir de uma creator com cadastro completo (aba
            Envios no modal da creator).
          </p>
        </div>
      ) : view === "kanban" ? (
        <ShipmentKanban
          items={items}
          onSelect={setSelectedId}
          onChanged={refresh}
        />
      ) : (
        <ShipmentTable items={items} onSelect={setSelectedId} />
      )}

      {view === "list" && hasMore ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? "Carregando…" : "Carregar mais"}
          </Button>
        </div>
      ) : null}

      <ShipmentModal
        shipmentId={selectedId}
        onClose={() => setSelectedId(null)}
        onChanged={refresh}
      />
    </div>
  );
}
