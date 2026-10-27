"use client";

import { useState } from "react";
import { LoginForm } from "@/app/login/login-form";
import { PortalFirstAccess } from "@/features/portal/components/portal-first-access";

export function PortalLoginPanel({ next }: { next: string }) {
  const [mode, setMode] = useState<"login" | "first">("login");
  return (
    <div className="space-y-4">
      {mode === "login" ? <LoginForm next={next} /> : <PortalFirstAccess onLogin={() => setMode("login")} />}
      <p className="text-center text-sm text-muted-foreground">
        {mode === "login" ? "Primeiro acesso? " : "Já tem senha? "}
        <button type="button" className="font-medium text-primary hover:underline" onClick={() => setMode(mode === "login" ? "first" : "login")}>
          {mode === "login" ? "Criar minha senha" : "Entrar"}
        </button>
      </p>
    </div>
  );
}
