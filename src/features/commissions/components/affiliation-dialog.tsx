"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { saveCreatorAffiliation } from "@/features/shopify/actions";
import { suggestAffiliateCode } from "@/lib/shopify/codes";
import type { CreatorAffiliation } from "@/types/database";

interface Props {
  /** Edit mode: a fixed creator. Create mode: pick from `creators`. */
  creator?: { id: string; name: string; affiliation: CreatorAffiliation | null };
  creators?: { id: string; name: string }[];
  shopConnected: boolean;
}

export function AffiliationDialog({ creator, creators = [], shopConnected }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const aff = creator?.affiliation ?? null;
  const [creatorId, setCreatorId] = useState<string | null>(creator?.id ?? null);
  const nameOf = (id: string | null) =>
    creator?.name ?? creators.find((c) => c.id === id)?.name ?? "";
  const [code, setCode] = useState(aff?.code ?? (creator ? suggestAffiliateCode(creator.name) : ""));
  const [rate, setRate] = useState(
    aff ? (aff.commission_rate != null ? String(aff.commission_rate) : "") : "10",
  );
  const [discount, setDiscount] = useState(aff?.discount_percent != null ? String(aff.discount_percent) : "10");
  const [createCoupon, setCreateCoupon] = useState(shopConnected && !aff?.shopify_discount_id);
  const [error, setError] = useState<string | null>(null);

  function save() {
    if (!creatorId) return setError("Escolha a creator.");
    setError(null);
    startTransition(async () => {
      const res = await saveCreatorAffiliation({
        creatorId,
        code,
        commissionRate: rate.trim() ? Number(rate.replace(",", ".")) : null,
        discountPercent: discount.trim() ? Number(discount.replace(",", ".")) : null,
        createCoupon,
        active: true,
      });
      if (res.ok) {
        toast.success(res.message ?? "Salvo.");
        setOpen(false);
      } else setError(res.error ?? "Não foi possível salvar.");
    });
  }

  return (
    <>
      {creator ? (
        <Button variant="ghost" size="icon-sm" aria-label="Editar comissão" onClick={() => setOpen(true)}>
          <Pencil />
        </Button>
      ) : (
        <Button onClick={() => setOpen(true)}>
          <Plus /> Vincular creator
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{creator ? `Comissão de ${creator.name}` : "Vincular creator"}</DialogTitle>
            <DialogDescription>
              O código vira o cupom na loja e também é procurado nas UTMs (utm_campaign ou utm_content).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {!creator ? (
              <div className="space-y-1.5">
                <Label>Creator</Label>
                <Select
                  items={creators.map((c) => ({ value: c.id, label: c.name }))}
                  value={creatorId}
                  onValueChange={(v) => {
                    setCreatorId(v as string);
                    if (!code) setCode(suggestAffiliateCode(nameOf(v as string)));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Escolha uma creator aprovada" />
                  </SelectTrigger>
                  <SelectContent>
                    {creators.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="aff-code">Código (cupom e UTM)</Label>
              <Input
                id="aff-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                placeholder="MARIANA10"
                autoComplete="off"
              />
              <p className="text-[0.8125rem] text-faint">
                Link rastreado: <code>?utm_campaign={code || "CODIGO"}</code>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="aff-rate">Comissão (%)</Label>
                <Input
                  id="aff-rate"
                  inputMode="decimal"
                  value={rate}
                  placeholder="A definir"
                  onChange={(e) => setRate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aff-discount">Desconto do cupom (%)</Label>
                <Input id="aff-discount" inputMode="decimal" value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
            </div>

            {shopConnected ? (
              <label className="flex items-start gap-2.5 rounded-2xl bg-surface px-3.5 py-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-[var(--primary)]"
                  checked={createCoupon}
                  onChange={(e) => setCreateCoupon(e.target.checked)}
                />
                <span>
                  Criar o cupom <b>{code || "—"}</b> na Shopify
                  {aff?.shopify_discount_id && aff.code === code ? " (já existe — não será recriado)" : ""}
                </span>
              </label>
            ) : (
              <p className="rounded-2xl bg-surface px-3.5 py-3 text-[0.8125rem] text-muted-foreground">
                Conecte a loja Shopify para o Zoviah criar o cupom automaticamente.
              </p>
            )}

            {error ? (
              <p role="alert" className="rounded-2xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
                {error}
              </p>
            ) : null}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={pending}>
                {pending ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
