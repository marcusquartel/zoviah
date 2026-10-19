"use client";

import { useTransition } from "react";
import { RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { disconnectShopify, syncShopifyNow } from "@/features/shopify/actions";

export function ConnectionActions({ canManage }: { canManage: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await syncShopifyNow();
            if (res.ok) toast.success(res.message ?? "Sincronizado.");
            else toast.error(res.error ?? "Erro ao sincronizar.");
          })
        }
      >
        <RefreshCw className={pending ? "animate-spin" : undefined} />
        {pending ? "Sincronizando…" : "Sincronizar agora"}
      </Button>
      {canManage ? (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (!window.confirm("Desconectar a loja? Os pedidos já importados continuam aqui.")) return;
            startTransition(async () => {
              const res = await disconnectShopify();
              if (res.ok) toast.success(res.message ?? "Desconectada.");
              else toast.error(res.error ?? "Erro.");
            });
          }}
        >
          <Unplug /> Desconectar
        </Button>
      ) : null}
    </div>
  );
}
