"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LifeBuoy, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  askAssistant,
  sendFeedback,
  escalateToTicket,
} from "@/features/support/actions";

interface Turn {
  role: "user" | "assistant";
  content: string;
  sufficient?: boolean;
}

/**
 * Global "Ajuda" hub (§12): the AI assistant, a link to "Minhas solicitações",
 * "Enviar sugestão" and the public roadmap. The assistant answers only from
 * the knowledge base and always offers human support when it is unsure.
 */
export function HelpCenter() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [offerHuman, setOfferHuman] = useState(false);
  const [pending, startTransition] = useTransition();

  function ask() {
    const q = question.trim();
    if (q.length < 3) return;
    setQuestion("");
    setTurns((t) => [...t, { role: "user", content: q }]);
    setOfferHuman(false);
    startTransition(async () => {
      const res = await askAssistant({
        question: q,
        route: pathname,
        conversationId,
      });
      if (!res.ok) {
        toast.error(res.error ?? "Não foi possível responder agora.");
        return;
      }
      setConversationId(res.conversationId);
      setTurns((t) => [
        ...t,
        {
          role: "assistant",
          content: res.answer ?? "",
          sufficient: res.sufficient,
        },
      ]);
      if (!res.sufficient || res.assistantUnavailable) setOfferHuman(true);
    });
  }

  function feedback(resolved: boolean) {
    if (!conversationId) return;
    startTransition(async () => {
      await sendFeedback(conversationId, resolved);
      if (resolved) {
        toast.success("Que bom! Marcamos como resolvido.");
        setOfferHuman(false);
      } else {
        setOfferHuman(true);
      }
    });
  }

  function escalate() {
    if (!conversationId) return;
    const lastUser = [...turns].reverse().find((t) => t.role === "user");
    startTransition(async () => {
      const res = await escalateToTicket({
        conversationId,
        type: "question",
        subject: lastUser?.content.slice(0, 120) ?? "Preciso de ajuda",
        description:
          turns
            .map((t) => `${t.role === "user" ? "Eu" : "Assistente"}: ${t.content}`)
            .join("\n\n") || "Solicitação aberta pelo cliente.",
      });
      if (res.ok) {
        toast.success("Enviado ao suporte. Você acompanha em Minhas solicitações.");
        setOfferHuman(false);
      } else {
        toast.error(res.error ?? "Não foi possível abrir a solicitação.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
          >
            <LifeBuoy className="size-4" />
            <span>Ajuda</span>
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Central de ajuda</DialogTitle>
          <DialogDescription>
            Pergunte ao assistente. Ele responde com base na documentação e, se
            não souber, encaminha para uma pessoa.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="max-h-64 space-y-3 overflow-y-auto rounded-md border bg-muted/30 p-3 text-sm">
            {turns.length === 0 ? (
              <p className="text-muted-foreground">
                Ex.: “Como solicito o endereço de um creator?”
              </p>
            ) : (
              turns.map((t, i) => (
                <div
                  key={i}
                  className={
                    t.role === "user"
                      ? "text-foreground"
                      : "rounded-md bg-background p-2 text-foreground ring-1 ring-border"
                  }
                >
                  <span className="mr-1 text-xs font-semibold text-muted-foreground">
                    {t.role === "user" ? "Você" : "Assistente"}:
                  </span>
                  {t.content}
                </div>
              ))
            )}
            {pending ? (
              <p className="text-xs text-muted-foreground">Pensando…</p>
            ) : null}
          </div>

          {turns.some((t) => t.role === "assistant") && !offerHuman ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              Isto respondeu sua dúvida?
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => feedback(true)}
                disabled={pending}
                aria-label="Sim, resolveu"
              >
                <ThumbsUp className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                onClick={() => feedback(false)}
                disabled={pending}
                aria-label="Não resolveu"
              >
                <ThumbsDown className="size-3.5" />
              </Button>
            </div>
          ) : null}

          {offerHuman ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <p className="mb-2">Quer falar com o suporte humano?</p>
              <Button size="sm" onClick={escalate} disabled={pending}>
                Falar com suporte
              </Button>
            </div>
          ) : null}

          <div className="flex items-end gap-2">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Escreva sua pergunta"
              rows={2}
              className="resize-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask();
                }
              }}
            />
            <Button
              size="icon"
              onClick={ask}
              disabled={pending || question.trim().length < 3}
              aria-label="Enviar"
            >
              <Send className="size-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 border-t pt-3 text-sm">
            <Link
              href="/app/ajuda"
              className="font-medium text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              Base de conhecimento
            </Link>
            <Link
              href="/app/support"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              Minhas solicitações
            </Link>
            <Link
              href="/app/suggestions"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              Enviar sugestão
            </Link>
            <Link
              href="/app/roadmap"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              Roadmap
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
