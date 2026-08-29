"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/features/creators/format";
import { loadShipmentsTab } from "@/features/creators/data-actions";
import { ShipmentStatusBadge } from "@/features/shipments/status-badge";
import { NewShipmentDialog } from "@/features/shipments/components/new-shipment-dialog";
import type { ShipmentsTabData } from "@/features/creators/data-actions";
import type { ApplicationStatus } from "@/types/database";

export function ShipmentsTab({
  applicationId,
  creatorId,
  applicationStatus,
}: {
  applicationId: string;
  creatorId: string;
  applicationStatus: ApplicationStatus;
}) {
  const [data, setData] = useState<ShipmentsTabData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const reload = useCallback(async () => {
    setData(await loadShipmentsTab(applicationId, creatorId));
  }, [applicationId, creatorId]);

  useEffect(() => {
    let active = true;
    void loadShipmentsTab(applicationId, creatorId).then((d) => {
      if (!active) return;
      setData(d);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [applicationId, creatorId]);

  if (!loaded || !data) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  const canCreate =
    applicationStatus === "completed" && data.hasCurrentAddress;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {data.shipments.length === 0
            ? "Nenhum envio para esta inscrição."
            : `${data.shipments.length} ${
                data.shipments.length === 1 ? "envio" : "envios"
              }`}
        </p>
        {canCreate ? (
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" /> Novo envio
          </Button>
        ) : null}
      </div>

      {!canCreate && applicationStatus !== "completed" ? (
        <p className="rounded-md bg-surface px-3 py-2 text-xs text-muted-foreground">
          Envios ficam disponíveis quando a inscrição está com cadastro completo.
        </p>
      ) : !canCreate ? (
        <p className="rounded-md bg-surface px-3 py-2 text-xs text-muted-foreground">
          Esta creator ainda não possui endereço disponível para envio.
        </p>
      ) : null}

      {data.shipments.length > 0 ? (
        <ul className="divide-y rounded-lg border">
          {data.shipments.map((s) => (
            <li key={s.id}>
              <Link
                href={`/app/shipments?s=${s.id}`}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium">
                    <Package className="size-3.5 text-muted-foreground" />
                    {s.first_item_name ?? "Sem itens"}
                    {s.item_count > 1 ? (
                      <span className="text-muted-foreground">
                        {" "}
                        + {s.item_count - 1}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Criado {formatDate(s.created_at)}
                    {s.shipped_at
                      ? ` · enviado ${formatDate(s.shipped_at)}`
                      : ""}
                    {s.delivered_at
                      ? ` · entregue ${formatDate(s.delivered_at)}`
                      : ""}
                  </p>
                </div>
                <ShipmentStatusBadge status={s.status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <NewShipmentDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        applicationId={applicationId}
        onCreated={() => void reload()}
      />
    </div>
  );
}
