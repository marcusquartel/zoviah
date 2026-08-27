"use client";

import { useActionState, useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProgram, type ActionState } from "@/features/programs/actions";
import {
  PROGRAM_STATUS_LABELS,
  PROGRAM_STATUS_ORDER,
} from "@/features/programs/status";
import type { Program } from "@/types/database";

const initial: ActionState = {};

export function GeneralForm({ program }: { program: Program }) {
  const action = updateProgram.bind(null, program.id);
  const [state, formAction, pending] = useActionState(action, initial);
  const uid = useId();

  return (
    <form action={formAction} className="max-w-2xl space-y-8">
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Identificação interna
        </h2>
        <div className="grid gap-2">
          <Label htmlFor={`${uid}-name`}>Nome</Label>
          <Input
            id={`${uid}-name`}
            name="name"
            defaultValue={program.name}
            required
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${uid}-slug`}>Slug</Label>
          <Input
            id={`${uid}-slug`}
            name="slug"
            defaultValue={program.slug}
            required
          />
          <p className="text-xs text-muted-foreground">
            Usado na URL pública. Único dentro da organização.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${uid}-description`}>Descrição interna</Label>
          <Textarea
            id={`${uid}-description`}
            name="description"
            defaultValue={program.description ?? ""}
            rows={2}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${uid}-status`}>Status</Label>
          <Select name="status" defaultValue={program.status}>
            <SelectTrigger id={`${uid}-status`} className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROGRAM_STATUS_ORDER.map((s) => (
                <SelectItem key={s} value={s}>
                  {PROGRAM_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Só programas <strong>Ativos</strong> aceitam novas inscrições.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Conteúdo da página pública
        </h2>
        <div className="grid gap-2">
          <Label htmlFor={`${uid}-public-title`}>Título público</Label>
          <Input
            id={`${uid}-public-title`}
            name="public_title"
            defaultValue={program.public_title ?? ""}
            placeholder={program.name}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${uid}-public-description`}>Descrição pública</Label>
          <Textarea
            id={`${uid}-public-description`}
            name="public_description"
            defaultValue={program.public_description ?? ""}
            rows={3}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`${uid}-success`}>Mensagem de sucesso</Label>
          <Textarea
            id={`${uid}-success`}
            name="success_message"
            defaultValue={program.success_message ?? ""}
            rows={2}
            placeholder="Recebemos sua inscrição! Em breve entraremos em contato."
          />
        </div>
      </section>

      {state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="text-sm text-success" role="status">
          Programa salvo.
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Salvando…" : "Salvar"}
      </Button>
    </form>
  );
}
