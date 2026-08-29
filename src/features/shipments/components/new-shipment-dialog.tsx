"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createShipment } from "@/features/shipments/actions";
import {
  ItemsEditor,
  emptyItem,
  type ItemRow,
} from "@/features/shipments/components/items-editor";

export function NewShipmentDialog({
  open,
  onOpenChange,
  applicationId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  onCreated: (shipmentId?: string) => void;
}) {
  const [rows, setRows] = useState<ItemRow[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();

  // Re-seed each time the dialog opens.
  const [seen, setSeen] = useState(false);
  if (open && !seen) {
    setSeen(true);
    setRows([emptyItem()]);
    setNotes("");
  }
  if (!open && seen) setSeen(false);

  function submit() {
    startTransition(async () => {
      const res = await createShipment({
        applicationId,
        items: rows.map((r) => ({
          itemName: r.itemName,
          sku: r.sku,
          quantity: r.quantity,
        })),
        internalNotes: notes,
      });
      if (res.ok) {
        toast.success("Envio criado (rascunho).");
        onOpenChange(false);
        onCreated(res.shipmentId);
      } else {
        toast.error(res.error ?? "Não foi possível criar o envio.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo envio</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="space-y-1.5">
            <Label>Itens</Label>
            <ItemsEditor rows={rows} onChange={setRows} disabled={pending} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="ship-notes">Nota interna (opcional)</Label>
            <Textarea
              id="ship-notes"
              rows={2}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: enviar junto com material impresso."
            />
          </div>
          <p className="text-xs text-muted-foreground">
            O endereço atual da creator é copiado para o envio no momento da
            criação.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Criando…" : "Criar envio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
