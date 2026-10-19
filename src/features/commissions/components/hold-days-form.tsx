"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setCommissionHoldDays } from "@/features/shopify/actions";

export function HoldDaysForm({ days, canEdit }: { days: number; canEdit: boolean }) {
  const [value, setValue] = useState(String(days));
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        aria-label="Dias até a comissão ser liberada"
        className="w-24"
        inputMode="numeric"
        value={value}
        disabled={!canEdit}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
      />
      <span className="text-sm text-muted-foreground">dias após o pagamento do pedido</span>
      {canEdit ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending || value === String(days) || value === ""}
          onClick={() =>
            startTransition(async () => {
              const res = await setCommissionHoldDays(Number(value));
              if (res.ok) toast.success(res.message ?? "Salvo.");
              else toast.error(res.error ?? "Erro.");
            })
          }
        >
          Salvar
        </Button>
      ) : null}
    </div>
  );
}
