"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteProgram } from "@/features/programs/actions";

export function DeleteProgramButton({
  programId,
  programName,
}: {
  programId: string;
  programName: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`Excluir ${programName}`}
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            `Excluir o programa "${programName}"? Esta ação não pode ser desfeita.`,
          )
        ) {
          return;
        }
        startTransition(async () => {
          const res = await deleteProgram(programId);
          if (res.error) toast.error(res.error);
        });
      }}
    >
      <Trash2 className="size-4 text-muted-foreground" />
    </Button>
  );
}
