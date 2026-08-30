"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/features/team/actions";

export function AcceptInvite({
  token,
  userEmail,
}: {
  token: string;
  userEmail: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setError(null);
    startTransition(async () => {
      const res = await acceptInvite(token);
      if (res.ok) {
        setDone(true);
        setTimeout(() => router.push("/app"), 1200);
      } else {
        setError(res.error ?? "Não foi possível aceitar o convite.");
      }
    });
  }

  if (done) {
    return (
      <div className="space-y-2">
        <CheckCircle2 className="mx-auto size-8 text-success" />
        <p className="text-sm">Convite aceito. Redirecionando…</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Conta atual: <strong>{userEmail}</strong>
      </p>
      <Button className="w-full" onClick={accept} disabled={pending}>
        {pending ? "Aceitando…" : "Aceitar convite"}
      </Button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
