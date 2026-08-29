"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDate } from "@/features/creators/format";
import {
  SHIPMENT_KANBAN_COLUMNS,
  SHIPMENT_STATUS_LABELS,
  nextShipmentStatuses,
  shipmentActionLabel,
} from "@/features/shipments/status";
import { transitionShipmentStatus } from "@/features/shipments/actions";
import type { ShipmentListItem, ShipmentStatus } from "@/types/database";

export function ShipmentKanban({
  items,
  onSelect,
  onChanged,
}: {
  items: ShipmentListItem[];
  onSelect: (id: string) => void;
  onChanged: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const byStatus = new Map<ShipmentStatus, ShipmentListItem[]>();
  for (const s of SHIPMENT_KANBAN_COLUMNS) byStatus.set(s, []);
  for (const it of items) byStatus.get(it.status)?.push(it);

  function move(id: string, to: ShipmentStatus) {
    startTransition(async () => {
      const res = await transitionShipmentStatus({ shipmentId: id, toStatus: to });
      if (res.ok) onChanged();
      else toast.error(res.error ?? "Não foi possível mover o envio.");
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {SHIPMENT_KANBAN_COLUMNS.map((status) => {
        const column = byStatus.get(status) ?? [];
        return (
          <section
            key={status}
            className="flex w-64 shrink-0 flex-col rounded-lg bg-surface"
            aria-label={SHIPMENT_STATUS_LABELS[status]}
          >
            <header className="flex items-center justify-between px-3 py-2 text-sm font-medium">
              <span>{SHIPMENT_STATUS_LABELS[status]}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {column.length}
              </span>
            </header>
            <div className="flex flex-1 flex-col gap-2 p-2 pt-0">
              {column.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                  Vazio
                </p>
              ) : (
                column.map((it) => {
                  const options = nextShipmentStatuses(it.status);
                  return (
                    <div
                      key={it.id}
                      className={cn(
                        "rounded-lg border bg-card p-3 text-sm shadow-xs",
                        pending && "opacity-60",
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(it.id)}
                        className="block w-full text-left"
                      >
                        <p className="font-medium leading-tight">
                          {it.creator_name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {it.first_item_name ?? "Sem itens"}
                          {it.item_count > 1 ? ` + ${it.item_count - 1}` : ""}
                        </p>
                        <p className="mt-1 text-[0.7rem] text-muted-foreground">
                          {formatDate(it.created_at)}
                        </p>
                      </button>
                      {options.length > 0 ? (
                        <div className="mt-2 flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className="rounded border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                              disabled={pending}
                            >
                              Mover para…
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {options.map((to) => (
                                <DropdownMenuItem
                                  key={to}
                                  onClick={() => move(it.id, to)}
                                  variant={
                                    to === "cancelled" ? "destructive" : "default"
                                  }
                                >
                                  {shipmentActionLabel(it.status, to)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
