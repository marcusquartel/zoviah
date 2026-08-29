"use client";

import { Camera, GripVertical, Music2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AnalysisCell } from "@/features/analysis/components/analysis-cell";
import { nextStatuses, statusActionLabel } from "@/features/applications/status";
import { formatDate, formatFollowers } from "@/features/creators/format";
import type { ApplicationListItem, ApplicationStatus } from "@/types/database";

interface CardProps {
  item: ApplicationListItem;
  moving: boolean;
  onSelect: () => void;
  onMove: (to: ApplicationStatus) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export function CreatorKanbanCard({
  item,
  moving,
  onSelect,
  onMove,
  onDragStart,
  onDragEnd,
}: CardProps) {
  const options = nextStatuses(item.status);

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", item.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group rounded-lg border bg-card p-3 text-sm shadow-xs transition-opacity",
        moving ? "opacity-60" : "cursor-grab active:cursor-grabbing",
      )}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground" />
        <button
          type="button"
          onClick={onSelect}
          className="block w-full text-left"
        >
          <p className="font-medium leading-tight">{item.creator_name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {item.program_name}
          </p>
        </button>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {item.instagram_handle ? (
          <span className="flex items-center gap-1">
            <Camera className="size-3" />
            {formatFollowers(item.instagram_followers)}
          </span>
        ) : null}
        {item.tiktok_handle ? (
          <span className="flex items-center gap-1">
            <Music2 className="size-3" />
            {formatFollowers(item.tiktok_followers)}
          </span>
        ) : null}
        <span>{formatDate(item.submitted_at)}</span>
        <AnalysisCell item={item} compact />
      </div>

      {options.length > 0 ? (
        <div className="mt-2 flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
              disabled={moving}
            >
              Mover
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {options.map((to) => (
                <DropdownMenuItem
                  key={to}
                  onClick={() => onMove(to)}
                  variant={to === "archived" ? "destructive" : "default"}
                >
                  {statusActionLabel(item.status, to)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}
    </div>
  );
}
