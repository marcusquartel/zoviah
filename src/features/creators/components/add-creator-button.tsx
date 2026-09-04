"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AddCreatorDialog } from "@/features/creators/components/add-creator-dialog";
import type { ProgramStatus } from "@/types/database";

export function AddCreatorButton({
  programs,
}: {
  programs: { id: string; name: string; status: ProgramStatus }[];
}) {
  const [open, setOpen] = useState(false);
  const active = programs
    .filter((p) => p.status === "active")
    .map((p) => ({ id: p.id, name: p.name }));

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Adicionar creator
      </Button>
      <AddCreatorDialog open={open} onOpenChange={setOpen} programs={active} />
    </>
  );
}
