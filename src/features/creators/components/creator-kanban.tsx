"use client";

import { CreatorKanbanCard } from "@/features/creators/components/creator-kanban-card";
import {
  APPLICATION_STATUS_LABELS,
  KANBAN_COLUMNS,
} from "@/features/applications/status";
import type { ApplicationListItem, ApplicationStatus } from "@/types/database";

interface KanbanProps {
  items: ApplicationListItem[];
  onSelect: (applicationId: string) => void;
  onMove: (applicationId: string, to: ApplicationStatus) => void;
}

export function CreatorKanban({ items, onSelect, onMove }: KanbanProps) {
  const byStatus = new Map<ApplicationStatus, ApplicationListItem[]>();
  for (const status of KANBAN_COLUMNS) byStatus.set(status, []);
  for (const it of items) byStatus.get(it.status)?.push(it);

  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {KANBAN_COLUMNS.map((status) => {
        const column = byStatus.get(status) ?? [];
        return (
          <section
            key={status}
            className="flex w-72 shrink-0 flex-col rounded-lg bg-surface"
            aria-label={APPLICATION_STATUS_LABELS[status]}
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
                  Vazio
                </p>
              ) : (
                column.map((item) => (
                  <CreatorKanbanCard
                    key={item.id}
                    item={item}
                    onSelect={() => onSelect(item.id)}
                    onOptimisticMove={(to) => onMove(item.id, to)}
                    onRevert={(to) => onMove(item.id, to)}
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
