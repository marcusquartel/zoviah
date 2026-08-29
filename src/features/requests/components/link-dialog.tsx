"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/features/creators/format";

export function SecureLinkDialog({
  open,
  onOpenChange,
  url,
  expiresAt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string | null;
  expiresAt: string | null;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the field is selectable as a fallback */
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link seguro criado</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {expiresAt ? (
            <p className="text-muted-foreground">
              Expira em {formatDate(expiresAt)} (7 dias).
            </p>
          ) : null}
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={url ?? ""}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-md border bg-muted/40 px-2 py-1.5 font-mono text-xs"
              aria-label="Link seguro"
            />
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? (
                <>
                  <Check className="size-4" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="size-4" /> Copiar link
                </>
              )}
            </Button>
          </div>
          <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
            Por segurança, este link é exibido somente agora. Se precisar
            novamente, gere um novo link.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
