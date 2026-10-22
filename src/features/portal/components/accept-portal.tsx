"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { acceptPortalInvite } from "@/features/portal/actions";

export function AcceptPortal({ token, userEmail }: { token: string; userEmail: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptPortalInvite(token);
      if (res.ok) router.push("/portal");
      else setError(res.error ?? "Não foi possível ativar o portal.");
    });
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Conta atual: <strong>{userEmail}</strong>
      </p>
      <Button className="w-full" onClick={accept} disabled={pending}>
        {pending ? "Ativando…" : "Ativar meu portal"}
      </Button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
