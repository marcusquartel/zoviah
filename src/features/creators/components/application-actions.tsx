"use client";

import { useTransition } from "react";
import { Archive, CheckCircle2, HelpCircle, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { nextStatuses } from "@/features/applications/status";
import { transitionApplicationStatus } from "@/features/creators/actions";
import type { ApplicationStatus } from "@/types/database";

const CONFIG: Record<
  ApplicationStatus,
  { label: string; icon: typeof CheckCircle2; variant: "default" | "outline" | "destructive"; confirm?: string }
> = {
  new: { label: "Voltar para Nova", icon: RotateCcw, variant: "outline" },
  awaiting_review: { label: "Reabrir para avaliação", icon: RotateCcw, variant: "outline" },
  approved: { label: "Aprovar", icon: CheckCircle2, variant: "default" },
  information_requested: {
    label: "Solicitar informações",
    icon: HelpCircle,
    variant: "outline",
  },
  archived: {
    label: "Arquivar",
    icon: Archive,
    variant: "destructive",
    confirm: "Arquivar esta inscrição?",
  },
};

export function ApplicationActions({
  applicationId,
  status,
  onDone,
}: {
  applicationId: string;
  status: ApplicationStatus;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const options = nextStatuses(status);

  function run(to: ApplicationStatus) {
    const cfg = CONFIG[to];
    if (cfg.confirm && !window.confirm(cfg.confirm)) return;
    startTransition(async () => {
      const res = await transitionApplicationStatus({
        applicationId,
        toStatus: to,
      });
      if (res.ok) {
        toast.success("Status atualizado.");
        onDone();
      } else {
        toast.error(res.error ?? "Não foi possível atualizar.");
      }
    });
  }

  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((to) => {
        const cfg = CONFIG[to];
        return (
          <Button
            key={to}
            size="sm"
            variant={cfg.variant}
            disabled={pending}
            onClick={() => run(to)}
          >
            <cfg.icon className="size-4" />
            {statusLabel(status, to, cfg.label)}
          </Button>
        );
      })}
    </div>
  );
}

function statusLabel(
  from: ApplicationStatus,
  to: ApplicationStatus,
  fallback: string,
): string {
  if (from === "archived" && to === "awaiting_review") return "Reabrir";
  return fallback;
}
