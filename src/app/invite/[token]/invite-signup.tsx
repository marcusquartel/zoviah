"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUpFromInvite } from "@/features/team/actions";

/**
 * Account creation from a valid invite. This is NOT a public signup — the
 * server only creates an account when the invite token validates, and the
 * e-mail comes from the invite, not from this form (we only show it, masked).
 */
export function InviteSignup({
  token,
  emailMasked,
  loginHref,
}: {
  token: string;
  emailMasked: string;
  loginHref: string;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmSent, setConfirmSent] = useState(false);
  const [done, setDone] = useState(false);

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
    startTransition(async () => {
      const res = await signUpFromInvite({ token, password });
      if (!res.ok) {
        if (res.accountExists) setMode("login");
        setError(res.error ?? "Não foi possível criar a conta.");
        return;
      }
      if (res.needsEmailConfirmation) {
        setConfirmSent(true);
        return;
      }
      if (res.accepted) {
        setDone(true);
        setTimeout(() => router.push("/app"), 1200);
        return;
      }
      // Account created but acceptance needs a retry — send them through login.
      router.push(loginHref);
    });
  }

  if (done) {
    return (
      <div className="space-y-2 text-center">
        <CheckCircle2 className="mx-auto size-8 text-success" />
        <p className="text-sm">Conta criada e convite aceito. Redirecionando…</p>
      </div>
    );
  }

  if (confirmSent) {
    return (
      <div className="space-y-2 text-center">
        <MailCheck className="mx-auto size-8 text-primary" />
        <p className="text-sm font-medium">Confirme seu e-mail</p>
        <p className="text-sm text-muted-foreground">
          Enviamos um link de confirmação para {emailMasked}. Depois de
          confirmar, volte a esta página para entrar na organização.
        </p>
      </div>
    );
  }

  if (mode === "login") {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-muted-foreground">
          {error ?? "Você já tem uma conta com este e-mail."}
        </p>
        <Link
          href={loginHref}
          className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Entrar para aceitar
        </Link>
        <button
          type="button"
          className="block w-full text-xs text-muted-foreground underline"
          onClick={() => {
            setMode("signup");
            setError(null);
          }}
        >
          Criar uma conta nova
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <p className="text-sm text-muted-foreground">
        Crie sua conta para <strong>{emailMasked}</strong> e entre na
        organização.
      </p>
      <div className="space-y-1.5 text-left">
        <Label htmlFor="signup-password">Senha</Label>
        <Input
          id="signup-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={pending}
          required
        />
      </div>
      <div className="space-y-1.5 text-left">
        <Label htmlFor="signup-confirm">Confirmar senha</Label>
        <Input
          id="signup-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          disabled={pending}
          required
        />
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Criando…" : "Criar conta e aceitar"}
      </Button>
      <Link
        href={loginHref}
        className="block text-center text-xs text-muted-foreground underline"
      >
        Já tenho uma conta
      </Link>
    </form>
  );
}
