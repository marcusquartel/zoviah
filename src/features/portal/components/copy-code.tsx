"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyCode({ code }: { code: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(`Cupom ${code} copiado.`);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }
  return (
    <Button variant="outline" size="sm" onClick={copy} aria-label={`Copiar cupom ${code}`}>
      <Copy className="size-4" /> Copiar
    </Button>
  );
}
