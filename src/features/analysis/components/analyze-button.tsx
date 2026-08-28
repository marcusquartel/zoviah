"use client";

import { useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { analyzeApplication } from "@/features/analysis/actions";

export function AnalyzeButton({
  applicationId,
  label = "Analisar creator",
  variant = "default",
  onDone,
}: {
  applicationId: string;
  label?: string;
  variant?: "default" | "outline";
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();

  function run() {
    if (
      label !== "Analisar creator" &&
      !window.confirm(
        "Uma nova análise será criada com a versão atual dos dados e critérios.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await analyzeApplication(applicationId);
      if (res.ok) {
        toast.success("Análise concluída.");
        onDone();
      } else {
        toast.error(res.error ?? "Não foi possível analisar.");
        onDone();
      }
    });
  }

  return (
    <Button
      size="sm"
      variant={variant}
      disabled={pending}
      onClick={run}
    >
      <Sparkles className="size-4" />
      {pending ? "Analisando…" : label}
    </Button>
  );
}
