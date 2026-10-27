"use client";

import { useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { startPortalAccess } from "@/features/portal/actions";

/** "Primeiro acesso": create the password with the e-mail of her signup. */
export function PortalFirstAccess({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("A senha deve ter ao menos 8 caracteres.");
    if (password !== confirm) return setError("As senhas não coincidem.");
    startTransition(async () => {
      const res = await startPortalAccess({ email, password });
      if (res.ok) setSent(true);
      else setError(res.error ?? "Não foi possível criar o acesso.");
    });
  }

  if (sent) {
    return (
      <div className="space-y-3 text-center">
        <MailCheck className="mx-auto size-8 text-primary" />
        <p className="text-sm">
          Enviamos um link de confirmação para <strong>{email}</strong>. Abra o e-mail e clique no link
          para entrar no seu portal.
        </p>
        <p className="text-xs text-muted-foreground">
          O portal abre para creators com cadastro aprovado pela marca, usando o mesmo e-mail da inscrição.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fa-email">E-mail da sua inscrição</Label>
        <Input id="fa-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fa-password">Crie uma senha</Label>
        <Input id="fa-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={pending} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fa-confirm">Repita a senha</Label>
        <Input id="fa-confirm" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={pending} />
      </div>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}{" "}
          {error.includes("já tem uma conta") ? (
            <button type="button" className="underline" onClick={onLogin}>
              Entrar
            </button>
          ) : null}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Criando…" : "Criar meu acesso"}
      </Button>
    </form>
  );
}
