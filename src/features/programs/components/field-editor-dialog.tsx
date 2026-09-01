"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
// This dialog is mounted with a `key` per field, so props are effectively
// initial values — local state is seeded once from them.
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BR_LOCATION_TYPES,
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
  FIELD_MAPPING_LABELS,
  SELECT_TYPES,
  mappingsForFieldType,
} from "@/lib/form-fields";
import { fieldKeyify } from "@/lib/slug";
import { updateFormField, type ActionState } from "@/features/programs/actions";
import type {
  FieldMapping,
  FieldOption,
  FieldType,
  FormField,
} from "@/types/database";

const initial: ActionState = {};
const NO_MAPPING = "__none__";

export function FieldEditorDialog({
  field,
  open,
  onOpenChange,
}: {
  field: FormField;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const action = updateFormField.bind(null, field.id);
  const [state, formAction, pending] = useActionState(action, initial);

  const [type, setType] = useState<FieldType>(field.field_type);
  const [mapping, setMapping] = useState<string>(
    field.configuration?.mapping ?? NO_MAPPING,
  );
  const [options, setOptions] = useState<FieldOption[]>(field.options ?? []);
  const [fieldKey, setFieldKey] = useState(field.field_key);

  useEffect(() => {
    if (state.success) onOpenChange(false);
  }, [state.success, onOpenChange]);

  const allowedMappings = useMemo(() => mappingsForFieldType(type), [type]);
  const isSelect = SELECT_TYPES.includes(type);
  const isBrLocation = BR_LOCATION_TYPES.includes(type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar campo</DialogTitle>
          <DialogDescription>
            As alterações estruturais incrementam a versão do formulário.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="field-label">Rótulo</Label>
            <Input
              id="field-label"
              name="label"
              defaultValue={field.label}
              required
              onChange={(e) => {
                if (fieldKey === field.field_key) {
                  setFieldKey(fieldKeyify(e.target.value));
                }
              }}
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="field-key">Chave</Label>
              <Input
                id="field-key"
                name="field_key"
                value={fieldKey}
                onChange={(e) => setFieldKey(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="field-type">Tipo</Label>
              <Select
                name="field_type"
                value={type}
                onValueChange={(v) => {
                  if (!v) return;
                  const next = v as FieldType;
                  setType(next);
                  const allowed = mappingsForFieldType(next);
                  if (
                    mapping !== NO_MAPPING &&
                    !allowed.includes(mapping as FieldMapping)
                  ) {
                    setMapping(NO_MAPPING);
                  }
                }}
              >
                <SelectTrigger id="field-type" className="w-full">
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
          </div>

          <div className="grid gap-2">
            <Label htmlFor="field-placeholder">Placeholder</Label>
            <Input
              id="field-placeholder"
              name="placeholder"
              defaultValue={field.placeholder ?? ""}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="field-help">Texto de ajuda</Label>
            <Input
              id="field-help"
              name="help_text"
              defaultValue={field.help_text ?? ""}
            />
          </div>

          {isBrLocation ? (
            <>
              <input
                type="hidden"
                name="mapping"
                value={type === "br_state" ? "state" : "city"}
              />
              <p className="rounded-md border border-dashed bg-surface px-3 py-2 text-xs text-muted-foreground">
                {type === "br_state"
                  ? "Lista fixa com as 27 UFs. Alimenta creators.state automaticamente."
                  : "Lista oficial do IBGE, filtrada pelo campo de Estado do formulário. Alimenta creators.city automaticamente."}
              </p>
            </>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="field-mapping">Mapear para</Label>
              <Select
                name="mapping"
                value={mapping}
                onValueChange={(v) => setMapping(v ?? NO_MAPPING)}
                disabled={allowedMappings.length === 0}
              >
                <SelectTrigger id="field-mapping" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_MAPPING}>
                    Nada (fica em answers)
                  </SelectItem>
                  {allowedMappings.map((m) => (
                    <SelectItem key={m} value={m}>
                      {FIELD_MAPPING_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {allowedMappings.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Este tipo de campo não alimenta colunas estruturadas.
                </p>
              ) : null}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="required" defaultChecked={field.required} />
            Resposta obrigatória
          </label>

          {isSelect ? (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-sm font-medium">Opções</p>
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    aria-label="Valor"
                    value={opt.value}
                    placeholder="valor"
                    onChange={(e) =>
                      setOptions((prev) =>
                        prev.map((o, j) =>
                          j === i ? { ...o, value: e.target.value } : o,
                        ),
                      )
                    }
                  />
                  <Input
                    aria-label="Rótulo"
                    value={opt.label}
                    placeholder="Rótulo"
                    onChange={(e) =>
                      setOptions((prev) =>
                        prev.map((o, j) =>
                          j === i ? { ...o, label: e.target.value } : o,
                        ),
                      )
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setOptions((prev) => prev.filter((_, j) => j !== i))
                    }
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOptions((prev) => [...prev, { value: "", label: "" }])
                }
              >
                <Plus className="size-3.5" />
                Adicionar opção
              </Button>
            </div>
          ) : null}

          <input
            type="hidden"
            name="options"
            value={JSON.stringify(isSelect ? options : [])}
          />

          {state.error ? (
            <p className="text-sm text-danger" role="alert">
              {state.error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando…" : "Salvar campo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
