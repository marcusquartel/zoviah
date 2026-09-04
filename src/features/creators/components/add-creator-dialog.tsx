"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { loadCreatorFormFields } from "@/features/creators/data-actions";
import { ManualCreatorForm } from "@/features/creators/components/manual-creator-form";
import { ImportCreatorsPanel } from "@/features/creators/components/import-creators-panel";
import type { PublicFieldDef } from "@/lib/form-fields";

interface ProgramOption {
  id: string;
  name: string;
}

type Mode = "manual" | "import";

export function AddCreatorDialog({
  open,
  onOpenChange,
  programs,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  programs: ProgramOption[];
}) {
  const [programId, setProgramId] = useState<string | null>(
    programs.length === 1 ? programs[0].id : null,
  );
  const [mode, setMode] = useState<Mode>("manual");
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState<{
    programSlug: string;
    fields: PublicFieldDef[];
  } | null>(null);

  useEffect(() => {
    if (!programId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      return;
    }
    setData(null);
    startTransition(async () => {
      const res = await loadCreatorFormFields(programId);
      if (res.program) {
        setData({ programSlug: res.program.slug, fields: res.fields });
      }
    });
  }, [programId]);

  function resetAndClose(next: boolean) {
    if (!next) {
      setProgramId(programs.length === 1 ? programs[0].id : null);
      setMode("manual");
      setData(null);
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar creator</DialogTitle>
          <DialogDescription>
            Cria uma inscrição manualmente, como se a pessoa tivesse enviado o
            formulário — mesma validação e mesma checagem de duplicados.
          </DialogDescription>
        </DialogHeader>

        {programs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum programa ativo. Ative um programa em Programas antes de
            adicionar creators.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor="add-creator-program">
                Programa
              </label>
              <Select
                value={programId ?? ""}
                onValueChange={(v) => v && setProgramId(v)}
              >
                <SelectTrigger id="add-creator-program" className="w-full">
                  <SelectValue placeholder="Selecione o programa" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {programId ? (
              <div className="inline-flex rounded-md border p-0.5">
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "manual" ? "secondary" : "ghost"}
                  onClick={() => setMode("manual")}
                >
                  Manual
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={mode === "import" ? "secondary" : "ghost"}
                  onClick={() => setMode("import")}
                >
                  Planilha
                </Button>
              </div>
            ) : null}

            {programId && pending ? (
              <p className="text-sm text-muted-foreground">Carregando campos…</p>
            ) : null}

            {programId && !pending && data ? (
              data.fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Este programa não tem campos ativos no formulário.
                </p>
              ) : mode === "manual" ? (
                <ManualCreatorForm
                  key={programId}
                  programId={programId}
                  fields={data.fields}
                  onCreated={() => {}}
                />
              ) : (
                <ImportCreatorsPanel
                  key={programId}
                  programId={programId}
                  programSlug={data.programSlug}
                  fields={data.fields}
                  onImported={() => {}}
                />
              )
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
