"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updateAppearance,
  type AppearanceState,
} from "@/features/settings/actions";

const initialState: AppearanceState = {};

interface AppearanceFormProps {
  primaryColor: string;
  secondaryColor: string;
  canEdit: boolean;
}

export function AppearanceForm({
  primaryColor,
  secondaryColor,
  canEdit,
}: AppearanceFormProps) {
  const [state, formAction, pending] = useActionState(
    updateAppearance,
    initialState,
  );

  return (
    <form action={formAction} className="max-w-md space-y-5">
      <div className="space-y-2">
        <Label htmlFor="primaryColor">Cor primária</Label>
        <Input
          id="primaryColor"
          name="primaryColor"
          defaultValue={primaryColor}
          placeholder="#4F46E5"
          disabled={!canEdit || pending}
        />
        <p className="text-xs text-muted-foreground">
          Hexadecimal (<code>#RGB</code> ou <code>#RRGGBB</code>). Vazio usa o
          tema neutro padrão.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="secondaryColor">Cor secundária</Label>
        <Input
          id="secondaryColor"
          name="secondaryColor"
          defaultValue={secondaryColor}
          placeholder="#E0E7FF"
          disabled={!canEdit || pending}
        />
      </div>

      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-success" role="status">
          Aparência salva.
        </p>
      ) : null}

      {canEdit ? (
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Somente owner e admin podem alterar a aparência.
        </p>
      )}
    </form>
  );
}
