"use client";

import { useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createProgram } from "@/features/programs/actions";

export function NewProgramButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() => startTransition(() => createProgram())}
    >
      <Plus className="size-4" />
      {pending ? "Criando…" : "Novo programa"}
    </Button>
  );
}
