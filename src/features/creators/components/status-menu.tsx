"use client";

import { useTransition } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { nextStatuses, statusActionLabel } from "@/features/applications/status";
import { transitionApplicationStatus } from "@/features/creators/actions";
import type { ApplicationStatus } from "@/types/database";

interface StatusMenuProps {
  applicationId: string;
  status: ApplicationStatus;
  /** Called after a successful transition (e.g. to reconcile optimistic UI). */
  onChanged?: (to: ApplicationStatus) => void;
  /** Called if the server rejects (e.g. to revert optimistic UI). */
  onError?: () => void;
  size?: "sm" | "xs";
  label?: string;
}

export function StatusMenu({
  applicationId,
  status,
  onChanged,
  onError,
  size = "sm",
  label = "Mudar status",
}: StatusMenuProps) {
  const [pending, startTransition] = useTransition();
  const options = nextStatuses(status);
  if (options.length === 0) return null;

  function move(to: ApplicationStatus) {
    startTransition(async () => {
      const res = await transitionApplicationStatus({
        applicationId,
        toStatus: to,
      });
      if (res.ok) {
        onChanged?.(to);
      } else {
        onError?.();
        toast.error(res.error ?? "Não foi possível mudar o status.");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size={size} disabled={pending} />
        }
      >
        {label}
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((to) => (
          <DropdownMenuItem
            key={to}
            onClick={() => move(to)}
            variant={to === "archived" ? "destructive" : "default"}
          >
            {statusActionLabel(status, to)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
