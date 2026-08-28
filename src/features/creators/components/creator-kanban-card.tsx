"use client";

import { useTransition } from "react";
import { Camera, Music2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AnalysisCell } from "@/features/analysis/components/analysis-cell";
import { nextStatuses, statusActionLabel } from "@/features/applications/status";
import { transitionApplicationStatus } from "@/features/creators/actions";
import { formatDate, formatFollowers } from "@/features/creators/format";
import type { ApplicationListItem, ApplicationStatus } from "@/types/database";

interface CardProps {
  item: ApplicationListItem;
  onSelect: () => void;
  onOptimisticMove: (to: ApplicationStatus) => void;
  onRevert: (to: ApplicationStatus) => void;
}

export function CreatorKanbanCard({
  item,
  onSelect,
  onOptimisticMove,
  onRevert,
}: CardProps) {
  const [pending, startTransition] = useTransition();
  const options = nextStatuses(item.status);

  function move(to: ApplicationStatus) {
    const from = item.status;
    onOptimisticMove(to);
    startTransition(async () => {
      const res = await transitionApplicationStatus({
        applicationId: item.id,
        toStatus: to,
      });
      if (!res.ok) {
        onRevert(from);
        toast.error(res.error ?? "Não foi possível mover o card.");
      }
    });
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-3 text-sm shadow-xs transition-opacity",
        pending && "opacity-60",
      )}
    >
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

      <div className="mt-2 flex items-center justify-between gap-2">
        {item.possible_duplicate ? (
          <Badge variant="secondary" className="gap-1 text-[0.65rem]">
            Poss. dup.
          </Badge>
        ) : (
          <span />
        )}
        {options.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className="rounded border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
              disabled={pending}
            >
              Mover
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {options.map((to) => (
                <DropdownMenuItem
                  key={to}
                  onClick={() => move(to)}
                  variant={to === "archived" ? "destructive" : "default"}
                >
                  {statusActionLabel(item.status, to)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
