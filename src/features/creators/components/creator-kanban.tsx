"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CreatorKanbanCard } from "@/features/creators/components/creator-kanban-card";
import {
  APPLICATION_STATUS_LABELS,
  KANBAN_COLUMNS,
  nextStatuses,
} from "@/features/applications/status";
import { transitionApplicationStatus } from "@/features/creators/actions";
import type { ApplicationListItem, ApplicationStatus } from "@/types/database";

interface KanbanProps {
  items: ApplicationListItem[];
  onSelect: (applicationId: string) => void;
  /** Optimistic patch of one card's status (revert on server error). */
  onMove: (applicationId: string, to: ApplicationStatus) => void;
}

export function CreatorKanban({ items, onSelect, onMove }: KanbanProps) {
  const [drag, setDrag] = useState<{
    id: string;
    from: ApplicationStatus;
  } | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const byStatus = new Map<ApplicationStatus, ApplicationListItem[]>();
  for (const status of KANBAN_COLUMNS) byStatus.set(status, []);
  for (const it of items) byStatus.get(it.status)?.push(it);

  function move(id: string, from: ApplicationStatus, to: ApplicationStatus) {
    if (from === to || !nextStatuses(from).includes(to)) return;
    setMovingId(id);
    onMove(id, to); // optimistic
    startTransition(async () => {
      const res = await transitionApplicationStatus({
        applicationId: id,
        toStatus: to,
      });
      setMovingId(null);
      if (!res.ok) {
        onMove(id, from); // revert
        toast.error(res.error ?? "Não foi possível mover o card.");
      }
    });
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {KANBAN_COLUMNS.map((status) => {
        const column = byStatus.get(status) ?? [];
        const canDrop =
          drag != null &&
          drag.from !== status &&
          nextStatuses(drag.from).includes(status);

        return (
          <section
            key={status}
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-lg bg-surface transition-colors",
              canDrop && "outline-2 outline-dashed outline-primary/60",
            )}
            aria-label={APPLICATION_STATUS_LABELS[status]}
            onDragOver={(e) => {
              if (canDrop) e.preventDefault();
            }}
            onDrop={(e) => {
              if (!canDrop || !drag) return;
              e.preventDefault();
              move(drag.id, drag.from, status);
              setDrag(null);
            }}
          >
            <header className="flex items-center justify-between px-3 py-2 text-sm font-medium">
              <span>{APPLICATION_STATUS_LABELS[status]}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {column.length}
              </span>
            </header>
            <div className="flex flex-1 flex-col gap-2 p-2 pt-0">
              {column.length === 0 ? (
                <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                  {canDrop ? "Soltar aqui" : "Vazio"}
                </p>
              ) : (
                column.map((item) => (
                  <CreatorKanbanCard
                    key={item.id}
                    item={item}
                    moving={movingId === item.id}
                    onSelect={() => onSelect(item.id)}
                    onMove={(to) => move(item.id, item.status, to)}
                    onDragStart={() =>
                      setDrag({ id: item.id, from: item.status })
                    }
                    onDragEnd={() => setDrag(null)}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
