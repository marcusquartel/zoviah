"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  updatePassword,
  type ResetPasswordState,
} from "@/features/auth/actions";
import { FORGOT_PASSWORD_PATH } from "@/features/auth/messages";

const initialState: ResetPasswordState = {};

/**
 * On success the server action `redirect()`s to /login?password_reset=success,
 * so there is no client-side "done" state and no re-render of this route.
 */
export function ResetForm() {
  const [state, formAction, pending] = useActionState(
    updatePassword,
    initialState,
  );
  const [clientError, setClientError] = useState<string | null>(null);

  if (state.expired) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-danger">{state.error}</p>
        <Link
          href={FORGOT_PASSWORD_PATH}
          className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Solicitar novo link
        </Link>
      </div>
    );
  }

  const error = clientError ?? state.error ?? null;

  return (
    <form
      action={formAction}
      className="space-y-4"
      onSubmit={(e) => {
        const form = e.currentTarget;
        const pw = (form.elements.namedItem("password") as HTMLInputElement).value;
        const cf = (form.elements.namedItem("confirm") as HTMLInputElement).value;
        if (pw.length < 8) {
          e.preventDefault();
          setClientError("A senha deve ter ao menos 8 caracteres.");
          return;
        }
        if (pw !== cf) {
          e.preventDefault();
          setClientError("As senhas não coincidem.");
          return;
        }
        setClientError(null);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          disabled={pending}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirmar nova senha</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
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
