"use client";

import { useActionState, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FIELD_TYPE_LABELS, FIELD_TYPES } from "@/lib/form-fields";
import { FieldEditorDialog } from "@/features/programs/components/field-editor-dialog";
import {
  addFormField,
  deleteFormField,
  moveFormField,
  toggleFormField,
  type ActionState,
} from "@/features/programs/actions";
import type { FormField } from "@/types/database";

const initialAdd: ActionState = {};

export function FormBuilder({
  programId,
  formVersion,
  fields,
}: {
  programId: string;
  formVersion: number;
  fields: FormField[];
}) {
  const addAction = addFormField.bind(null, programId);
  const [addState, addFormAction, adding] = useActionState(addAction, initialAdd);
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<FormField | null>(null);

  function run(promise: Promise<ActionState>) {
    startTransition(async () => {
      const res = await promise;
      if (res.error) toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">
        Versão do formulário: <strong>v{formVersion}</strong>. Cada application
        guarda a versão e um snapshot dos campos enviados.
      </p>

      <form
        action={addFormAction}
        className="flex flex-wrap items-end gap-3 rounded-lg border bg-surface p-3"
      >
        <div className="grid gap-1.5">
          <Label htmlFor="new-field-label" className="text-xs">
            Novo campo
          </Label>
          <Input
            id="new-field-label"
            name="label"
            placeholder="Ex.: Nome completo"
            className="w-64"
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="new-field-type" className="text-xs">
            Tipo
          </Label>
          <Select name="field_type" defaultValue="text">
            <SelectTrigger id="new-field-type" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {FIELD_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" size="sm" disabled={adding}>
          {adding ? "Adicionando…" : "Adicionar"}
        </Button>
        {addState.error ? (
          <p className="w-full text-sm text-danger" role="alert">
            {addState.error}
          </p>
        ) : null}
      </form>

      {fields.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-surface p-8 text-center text-sm text-muted-foreground">
          Nenhum campo ainda. Adicione o primeiro acima.
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {fields.map((field, index) => (
            <li
              key={field.id}
              className="flex items-center gap-3 p-3 data-[inactive=true]:opacity-55"
              data-inactive={!field.active}
            >
              <GripVertical className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex shrink-0 flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={index === 0 || pending}
                  aria-label="Mover para cima"
                  onClick={() => run(moveFormField(field.id, "up"))}
                >
                  <ArrowUp className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  disabled={index === fields.length - 1 || pending}
                  aria-label="Mover para baixo"
                  onClick={() => run(moveFormField(field.id, "down"))}
                >
                  <ArrowDown className="size-3.5" />
                </Button>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{field.label}</span>
                  <Badge variant="outline">
                    {FIELD_TYPE_LABELS[field.field_type]}
                  </Badge>
                  {field.required ? (
                    <Badge variant="secondary">Obrigatório</Badge>
                  ) : null}
                  {field.configuration?.mapping ? (
                    <Badge variant="secondary">
                      → {field.configuration.mapping}
                    </Badge>
                  ) : null}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {field.field_key}
                </p>
              </div>

              <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Checkbox
                  checked={field.active}
                  disabled={pending}
                  onCheckedChange={(checked) =>
                    run(toggleFormField(field.id, checked === true))
                  }
                />
                Ativo
              </label>

              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Editar campo"
                onClick={() => setEditing(field)}
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remover campo"
                disabled={pending}
                onClick={() => {
                  if (confirm(`Remover o campo "${field.label}"?`)) {
                    run(deleteFormField(field.id));
                  }
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {editing ? (
        <FieldEditorDialog
          key={editing.id}
          field={editing}
          open={editing !== null}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}
