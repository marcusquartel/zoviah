"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePassword } from "@/features/auth/actions";
import {
  FORGOT_PASSWORD_PATH,
  LOGIN_PATH,
} from "@/features/auth/messages";

export function ResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => router.push(LOGIN_PATH), 1800);
    return () => clearTimeout(t);
  }, [done, router]);

  function submit() {
    setError(null);
    if (password.length < 8) {
      setError("A senha deve ter ao menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    const fd = new FormData();
    fd.set("password", password);
    fd.set("confirm", confirm);
    startTransition(async () => {
      const res = await updatePassword({}, fd);
      if (res.ok) {
        setDone(true);
        return;
      }
      const msg = res.error ?? "Não foi possível alterar a senha.";
      if (/recupera|expir|ausente/i.test(msg)) setExpired(true);
      setError(msg);
    });
  }

  if (done) {
    return (
      <div className="space-y-2 text-center" role="status">
        <CheckCircle2 className="mx-auto size-8 text-success" />
        <p className="text-sm">Senha alterada. Redirecionando para entrar…</p>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-danger">{error}</p>
        <Link
          href={FORGOT_PASSWORD_PATH}
          className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Solicitar novo link
        </Link>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirmar nova senha</Label>
        <Input
          id="confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={pending}
          required
        />
      </div>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Alterando…" : "Alterar senha"}
      </Button>
    </form>
  );
}
