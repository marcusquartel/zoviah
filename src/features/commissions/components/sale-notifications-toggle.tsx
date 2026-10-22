"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setSaleNotifications } from "@/features/shopify/actions";

export function SaleNotificationsToggle({
  enabled,
  canEdit,
}: {
  enabled: boolean;
  canEdit: boolean;
}) {
  const [on, setOn] = useState(enabled);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setOn(next);
    startTransition(async () => {
      const res = await setSaleNotifications(next);
      if (res.ok) toast.success(res.message ?? "Salvo.");
      else {
        setOn(!next);
        toast.error(res.error ?? "Não foi possível salvar.");
      }
    });
  }

  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-[var(--primary)]"
        checked={on}
        disabled={!canEdit || pending}
        onChange={(e) => toggle(e.target.checked)}
      />
      <span>
        Enviar um e-mail para a creator a cada venda paga com o cupom dela
        <span className="mt-1 block text-[0.8125rem] text-faint">
          Vale para vendas feitas depois de ligar. Não inclui dados da cliente.
          Cada creator pode ser desligada na aba Comissão do detalhe dela.
        </span>
      </span>
    </label>
  );
}
