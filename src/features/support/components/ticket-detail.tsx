"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateSupportTicket,
  prepareEngineeringPrompt,
} from "@/features/support/admin-actions";
import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
} from "@/features/support/labels";
import type { AdminTicketDetail } from "@/features/support/admin-queries";

const STATUS_ITEMS = (
  Object.entries(TICKET_STATUS_LABELS) as [string, string][]
).map(([value, label]) => ({ value, label }));
const PRIORITY_ITEMS = (
  Object.entries(TICKET_PRIORITY_LABELS) as [string, string][]
).map(([value, label]) => ({ value, label }));

export function TicketDetail({ ticket }: { ticket: AdminTicketDetail }) {
  const [status, setStatus] = useState(ticket.status);
  const [priority, setPriority] = useState(ticket.priority);
  const [notes, setNotes] = useState(ticket.admin_notes ?? "");
  const [engPrompt, setEngPrompt] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save(extra?: { assignSelf?: boolean }) {
    startTransition(async () => {
      const res = await updateSupportTicket({
        ticketId: ticket.id,
        status,
        priority,
        adminNotes: notes,
        assignSelf: extra?.assignSelf,
      });
      if (res.ok) toast.success("Ticket atualizado.");
      else toast.error(res.error ?? "Falha ao atualizar.");
    });
  }

  function prepare() {
    startTransition(async () => {
      const res = await prepareEngineeringPrompt(ticket.id);
      if (res.ok && res.prompt) setEngPrompt(res.prompt);
      else toast.error(res.error ?? "Falha ao gerar o prompt.");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div className="space-y-4">
        <div className="rounded-lg border p-4">
          <h2 className="font-medium">{ticket.subject}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {ticket.organization_name}
            {ticket.organization_plan ? ` · ${ticket.organization_plan}` : ""} ·{" "}
            {ticket.reporter_email} · {ticket.module ?? "sem módulo"} ·{" "}
            {ticket.current_route ?? "sem rota"}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm">{ticket.description}</p>
        </div>

        {ticket.conversation && ticket.conversation.length > 0 ? (
          <div className="rounded-lg border p-4">
            <h3 className="mb-2 text-sm font-semibold">Conversa com o assistente</h3>
            <div className="space-y-2 text-sm">
              {ticket.conversation.map((m, i) => (
                <p key={i}>
                  <span className="mr-1 text-xs font-semibold text-muted-foreground">
                    {m.role === "user"
                      ? "Cliente"
                      : m.role === "assistant"
                        ? "Assistente"
                        : "Evento"}
                    :
                  </span>
                  {m.content}
                </p>
              ))}
            </div>
            {ticket.article_titles.length > 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Artigos consultados: {ticket.article_titles.join(", ")}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Preparar para engenharia</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={prepare}
              disabled={pending}
            >
              Gerar prompt
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Gera um prompt estruturado para copiar manualmente no Claude Code.
            Nada é enviado nem executado automaticamente; PII é removida.
          </p>
          {engPrompt ? (
            <div className="mt-3 space-y-2">
              <Textarea
                readOnly
                value={engPrompt}
                rows={12}
                className="font-mono text-xs"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  navigator.clipboard
                    .writeText(engPrompt)
                    .then(() => toast.success("Prompt copiado."))
                    .catch(() => toast.error("Não foi possível copiar."));
                }}
              >
                Copiar
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select
            items={STATUS_ITEMS}
            value={status}
            onValueChange={(v) =>
              setStatus((v ?? "open") as AdminTicketDetail["status"])
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_ITEMS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Prioridade</Label>
          <Select
            items={PRIORITY_ITEMS}
            value={priority}
            onValueChange={(v) =>
              setPriority((v ?? "normal") as AdminTicketDetail["priority"])
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_ITEMS.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notas internas</Label>
          <Textarea
            id="notes"
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Button onClick={() => save()} disabled={pending}>
            Salvar
          </Button>
          <Button
            variant="outline"
            onClick={() => save({ assignSelf: true })}
            disabled={pending}
          >
            Assumir e salvar
          </Button>
        </div>
        {ticket.assigned_email ? (
          <p className="text-xs text-muted-foreground">
            Responsável: {ticket.assigned_email}
          </p>
        ) : null}
      </aside>
    </div>
  );
}
