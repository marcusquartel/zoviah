"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatPercent } from "@/lib/money";
import { deleteTier, saveTier } from "@/features/tiers/actions";
import type { TierWithCount } from "@/features/tiers/queries";

export function TiersManager({
  tiers,
  canEdit,
}: {
  tiers: TierWithCount[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<TierWithCount | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  function remove(t: TierWithCount) {
    const msg =
      t.creators > 0
        ? `Excluir a categoria ${t.name}? ${t.creators} creator(s) ficarão sem categoria e, sem comissão individual, deixam de gerar comissão em vendas novas.`
        : `Excluir a categoria ${t.name}?`;
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      const res = await deleteTier(t.id);
      if (res.ok) toast.success("Categoria excluída.");
      else toast.error(res.error ?? "Não foi possível excluir.");
    });
  }

  return (
    <div className="space-y-4">
      {tiers.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Nenhuma categoria criada ainda.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {tiers.map((t) => (
            <li key={t.id} className="flex items-start gap-4 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{t.name}</p>
                <p className="text-sm text-muted-foreground">
                  Comissão {formatPercent(t.commission_rate)} ·{" "}
                  {t.creators === 1 ? "1 creator" : `${t.creators} creators`}
                </p>
                {t.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                ) : null}
              </div>
              {canEdit ? (
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar ${t.name}`}
                    onClick={() => setEditing(t)}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Excluir ${t.name}`}
                    disabled={pending}
                    onClick={() => remove(t)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canEdit ? (
        <Button onClick={() => setEditing("new")}>
          <Plus /> Nova categoria
        </Button>
      ) : null}

      <TierDialog
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        tier={editing === "new" ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

function TierDialog({
  tier,
  open,
  onClose,
}: {
  tier: TierWithCount | null;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(tier?.name ?? "");
  const [rate, setRate] = useState(tier ? String(tier.commission_rate) : "");
  const [description, setDescription] = useState(tier?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    const commissionRate = Number(rate.replace(",", "."));
    if (!rate.trim() || Number.isNaN(commissionRate)) {
      setError("Informe a comissão da categoria.");
      return;
    }
    startTransition(async () => {
      const res = await saveTier({
        id: tier?.id ?? null,
        name,
        commissionRate,
        description,
      });
      if (res.ok) {
        toast.success(tier ? "Categoria atualizada." : "Categoria criada.");
        onClose();
      } else setError(res.error ?? "Não foi possível salvar.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{tier ? `Editar ${tier.name}` : "Nova categoria"}</DialogTitle>
          <DialogDescription>
            A comissão da categoria vale para todas as creators dela que não
            tenham uma comissão individual.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tier-name">Nome</Label>
              <Input
                id="tier-name"
                value={name}
                placeholder="FORTE"
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tier-rate">Comissão (%)</Label>
              <Input
                id="tier-rate"
                inputMode="decimal"
                value={rate}
                placeholder="5"
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tier-description">Descrição (opcional)</Label>
            <Textarea
              id="tier-description"
              value={description}
              rows={3}
              placeholder="Critérios, benefícios, regras da categoria…"
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {tier && tier.creators > 0 ? (
            <p className="text-xs text-muted-foreground">
              Mudar a comissão vale para vendas que ainda não têm comissão
              calculada. Comissões já calculadas mantêm o percentual da época.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
