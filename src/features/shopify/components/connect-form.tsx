"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { connectShopify } from "@/features/shopify/actions";

const STEPS = [
  <>No admin da loja, abra <b>Configurações → Apps → Desenvolver apps</b> e clique em <b>Criar app no Dev Dashboard</b>.</>,
  <>Na versão do app, marque os escopos <code>read_orders</code> e <code>write_discounts</code> e libere a versão.</>,
  <>Instale o app na sua loja e aprove os escopos.</>,
  <>Em <b>Settings</b> do app, copie o <b>Client ID</b> e o <b>Client secret</b> e cole aqui.</>,
];

export function ConnectForm() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(form: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await connectShopify({
        shopDomain: String(form.get("shopDomain") ?? ""),
        clientId: String(form.get("clientId") ?? ""),
        clientSecret: String(form.get("clientSecret") ?? ""),
      });
      if (res.ok) toast.success(res.message ?? "Loja conectada.");
      else setError(res.error ?? "Não foi possível conectar.");
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <section className="flex flex-col rounded-[28px] bg-ink p-6 text-ink-foreground">
        <h2 className="text-[1.375rem] leading-tight">Conecte sua loja</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Com a loja conectada, o Zoviah importa os pedidos, atribui cada venda à creator pelo
          cupom ou pela UTM e calcula as comissões.
        </p>
        <ol className="mt-6 space-y-4">
          {STEPS.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[0.8rem] font-medium text-primary-foreground">
                {i + 1}
              </span>
              <span className="pt-0.5 text-ink-foreground/90 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1">
                {s}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <form action={onSubmit} className="flex flex-col gap-4 rounded-[28px] bg-card p-6">
        <div className="space-y-1.5">
          <Label htmlFor="shopDomain">Domínio da loja</Label>
          <Input id="shopDomain" name="shopDomain" placeholder="minha-loja.myshopify.com" required autoComplete="off" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clientId">Client ID</Label>
          <Input id="clientId" name="clientId" required autoComplete="off" spellCheck={false} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clientSecret">Client secret</Label>
          <Input id="clientSecret" name="clientSecret" type="password" required autoComplete="off" spellCheck={false} />
          <p className="text-[0.8125rem] text-faint">
            Guardado criptografado. Nunca é exibido de novo.
          </p>
        </div>
        {error ? (
          <p role="alert" className="rounded-2xl bg-danger/10 px-3.5 py-2.5 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" className="mt-auto self-start" disabled={pending}>
          {pending ? "Conectando…" : "Conectar loja"}
        </Button>
      </form>
    </div>
  );
}
