"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { loadCouponsTab, type CouponsTabData } from "@/features/creators/data-actions";
import { saveCreatorAffiliation, savePersonalCoupon } from "@/features/shopify/actions";
import { setCreatorTier } from "@/features/tiers/actions";
import { formatPercent } from "@/lib/money";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** "10" / "10,5" → number; "" → null; garbage → NaN (rejected by the action). */
function parsePercent(raw: string): number | null {
  const v = raw.trim();
  return v ? Number(v.replace(",", ".")) : null;
}

const toInput = (n: number | null | undefined) => (n != null ? String(n) : "");

const cleanCode = (v: string) => v.toUpperCase().replace(/\s+/g, "");

const NO_TIER = "none";

/**
 * Categoria + the creator's two coupons. The affiliate one is commissioned and attributes
 * sales to her (coupon or UTM); the personal one is her own discount and is
 * never attributed. Both link codes that already exist in the store — creating
 * a new coupon in Shopify stays on the Comissões page.
 */
export function CouponsTab({ creatorId }: { creatorId: string }) {
  const [data, setData] = useState<CouponsTabData | null>(null);

  useEffect(() => {
    let active = true;
    void loadCouponsTab(creatorId).then((d) => {
      if (active) setData(d);
    });
    return () => {
      active = false;
    };
  }, [creatorId]);

  if (!data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const tier = data.tiers.find((t) => t.id === data.tierId) ?? null;

  return (
    <div className="space-y-4">
      <TierPicker
        creatorId={creatorId}
        data={data}
        onChanged={(tierId) => setData({ ...data, tierId })}
      />
      <AffiliateCoupon creatorId={creatorId} data={data} tierRate={tier?.commission_rate ?? null} />
      <PersonalCoupon creatorId={creatorId} data={data} />
    </div>
  );
}

function TierPicker({
  creatorId,
  data,
  onChanged,
}: {
  creatorId: string;
  data: CouponsTabData;
  onChanged: (tierId: string | null) => void;
}) {
  const [pending, startTransition] = useTransition();
  const items = [
    { value: NO_TIER, label: "Sem categoria" },
    ...data.tiers.map((t) => ({
      value: t.id,
      label: `${t.name} — ${formatPercent(t.commission_rate)}`,
    })),
  ];

  function change(value: string) {
    const tierId = value === NO_TIER ? null : value;
    startTransition(async () => {
      const res = await setCreatorTier(creatorId, tierId);
      if (res.ok) {
        onChanged(tierId);
        toast.success("Categoria atualizada.");
      } else toast.error(res.error ?? "Não foi possível alterar a categoria.");
    });
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <p className="text-sm font-medium">Categoria</p>
        <p className="text-xs text-muted-foreground">
          Define a comissão padrão da creator.
        </p>
      </div>
      {data.tiers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma categoria criada. Crie em Configurações → Categorias.
        </p>
      ) : (
        <Select
          items={items}
          value={data.tierId ?? NO_TIER}
          onValueChange={(v) => change((v as string) ?? NO_TIER)}
          disabled={pending}
        >
          <SelectTrigger className="w-full" aria-label="Categoria">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((i) => (
              <SelectItem key={i.value} value={i.value}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </section>
  );
}

function AffiliateCoupon({
  creatorId,
  data,
  tierRate,
}: {
  creatorId: string;
  data: CouponsTabData;
  tierRate: number | null;
}) {
  const aff = data.affiliation;
  const [code, setCode] = useState(aff?.code ?? "");
  const [rate, setRate] = useState(toInput(aff?.commission_rate));
  const [discount, setDiscount] = useState(toInput(aff?.discount_percent));
  const [pending, startTransition] = useTransition();

  function save() {
    if (!code.trim()) {
      toast.error("Informe o código do cupom de divulgação.");
      return;
    }
    startTransition(async () => {
      const res = await saveCreatorAffiliation({
        creatorId,
        code,
        commissionRate: parsePercent(rate),
        discountPercent: parsePercent(discount),
        createCoupon: false,
        active: aff?.active ?? true,
      });
      if (res.ok) toast.success("Cupom de divulgação salvo.");
      else toast.error(res.error ?? "Não foi possível salvar.");
    });
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <p className="text-sm font-medium">Cupom de divulgação</p>
        <p className="text-xs text-muted-foreground">
          O que ela divulga para as seguidoras. As vendas com ele (ou com o código
          na UTM) contam como dela e geram comissão.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="aff-code">Código</Label>
        <Input
          id="aff-code"
          value={code}
          onChange={(e) => setCode(cleanCode(e.target.value))}
          placeholder="NOMEDACREATOR"
          autoComplete="off"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="aff-rate">Comissão individual (%)</Label>
          <Input
            id="aff-rate"
            inputMode="decimal"
            value={rate}
            placeholder={
              tierRate != null ? `Da categoria: ${formatPercent(tierRate)}` : "A definir"
            }
            onChange={(e) => setRate(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="aff-discount">Desconto do cupom (%)</Label>
          <Input
            id="aff-discount"
            inputMode="decimal"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </div>
      </div>
      {rate.trim() === "" && tierRate != null ? (
        <p className="text-xs text-muted-foreground">
          Sem comissão individual: vale a da categoria ({formatPercent(tierRate)}).
          Preencha só para uma exceção.
        </p>
      ) : aff && aff.commission_rate == null && tierRate == null ? (
        <p className="text-xs text-warning-foreground">
          Comissão ainda não definida: as vendas são atribuídas a ela, mas
          nenhuma comissão é calculada. Escolha uma categoria ou preencha a
          comissão individual.
        </p>
      ) : null}
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </section>
  );
}

function PersonalCoupon({ creatorId, data }: { creatorId: string; data: CouponsTabData }) {
  const personal = data.personal;
  const [code, setCode] = useState(personal?.code ?? "");
  const [discount, setDiscount] = useState(toInput(personal?.discount_percent));
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await savePersonalCoupon({
        creatorId,
        code,
        discountPercent: parsePercent(discount),
      });
      if (res.ok) toast.success(res.message ?? "Cupom pessoal salvo.");
      else toast.error(res.error ?? "Não foi possível salvar.");
    });
  }

  return (
    <section className="space-y-3 rounded-lg border p-4">
      <div>
        <p className="text-sm font-medium">Cupom pessoal</p>
        <p className="text-xs text-muted-foreground">
          Desconto exclusivo para a própria creator. Não gera comissão e as
          compras com ele não contam como vendas dela.
        </p>
      </div>
      <div className="grid grid-cols-[1fr_10rem] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="personal-code">Código</Label>
          <Input
            id="personal-code"
            value={code}
            onChange={(e) => setCode(cleanCode(e.target.value))}
            placeholder="AB15"
            autoComplete="off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="personal-discount">Desconto (%)</Label>
          <Input
            id="personal-discount"
            inputMode="decimal"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Deixe o código vazio e salve para remover.
        </p>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Salvando…" : "Salvar"}
        </Button>
      </div>
    </section>
  );
}
