"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface ItemRow {
  itemName: string;
  sku: string;
  quantity: string;
}

export const emptyItem = (): ItemRow => ({ itemName: "", sku: "", quantity: "1" });

export function ItemsEditor({
  rows,
  onChange,
  disabled,
}: {
  rows: ItemRow[];
  onChange: (rows: ItemRow[]) => void;
  disabled?: boolean;
}) {
  function set(i: number, patch: Partial<ItemRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[1fr_7rem_4.5rem_auto] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
        <span>Item</span>
        <span>SKU (opcional)</span>
        <span>Qtd.</span>
        <span />
      </div>
      {rows.map((row, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_7rem_4.5rem_auto] items-start gap-2"
        >
          <div>
            <Label className="sr-only" htmlFor={`item-${i}`}>
              Item {i + 1}
            </Label>
            <Input
              id={`item-${i}`}
              value={row.itemName}
              disabled={disabled}
              placeholder="Ex.: Glance Brow Lift"
              maxLength={200}
              onChange={(e) => set(i, { itemName: e.target.value })}
            />
          </div>
          <Input
            value={row.sku}
            disabled={disabled}
            placeholder="SKU"
            maxLength={100}
            aria-label={`SKU do item ${i + 1}`}
            onChange={(e) => set(i, { sku: e.target.value })}
          />
          <Input
            value={row.quantity}
            disabled={disabled}
            inputMode="numeric"
            aria-label={`Quantidade do item ${i + 1}`}
            onChange={(e) =>
              set(i, { quantity: e.target.value.replace(/[^\d]/g, "") })
            }
          />
          <div className="flex items-center gap-0.5">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled || i === 0}
              onClick={() => move(i, -1)}
              aria-label="Mover para cima"
            >
              <ArrowUp className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled || i === rows.length - 1}
              onClick={() => move(i, 1)}
              aria-label="Mover para baixo"
            >
              <ArrowDown className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled || rows.length === 1}
              onClick={() => remove(i)}
              aria-label="Remover item"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || rows.length >= 50}
        onClick={() => onChange([...rows, emptyItem()])}
      >
        <Plus className="size-4" /> Adicionar item
      </Button>
    </div>
  );
}
