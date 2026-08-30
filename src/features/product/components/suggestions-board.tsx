"use client";

import { useState, useTransition } from "react";
import { ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  submitFeatureRequest,
  voteFeatureRequest,
} from "@/features/product/actions";
import {
  FEATURE_STATUS_LABELS,
  FREQUENCY_LABELS,
  IMPORTANCE_LABELS,
  VOTE_SCOPE_NOTE,
} from "@/features/product/labels";
import type { FeatureRequestBoardItem } from "@/features/product/queries";

const FREQ_ITEMS = (
  Object.entries(FREQUENCY_LABELS) as [string, string][]
).map(([value, label]) => ({ value, label }));
const IMP_ITEMS = (
  Object.entries(IMPORTANCE_LABELS) as [string, string][]
).map(([value, label]) => ({ value, label }));

export function SuggestionsBoard({
  initial,
}: {
  initial: FeatureRequestBoardItem[];
}) {
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    title: "",
    problem: "",
    useCase: "",
    frequency: "sometimes",
    importance: "important",
  });

  function submit() {
    startTransition(async () => {
      const res = await submitFeatureRequest(form);
      if (res.ok) {
        toast.success("Sugestão enviada. Obrigado!");
        setForm({
          title: "",
          problem: "",
          useCase: "",
          frequency: "sometimes",
          importance: "important",
        });
      } else {
        toast.error(res.error ?? "Não foi possível enviar.");
      }
    });
  }

  function toggleVote(item: FeatureRequestBoardItem) {
    const next = !item.voted;
    setItems((list) =>
      list.map((x) =>
        x.id === item.id
          ? { ...x, voted: next, vote_count: x.vote_count + (next ? 1 : -1) }
          : x,
      ),
    );
    startTransition(async () => {
      const res = await voteFeatureRequest(item.id, next);
      if (!res.ok) {
        toast.error(res.error ?? "Não foi possível registrar o voto.");
        setItems((list) =>
          list.map((x) =>
            x.id === item.id
              ? { ...x, voted: item.voted, vote_count: item.vote_count }
              : x,
          ),
        );
      } else if (typeof res.voteCount === "number") {
        setItems((list) =>
          list.map((x) =>
            x.id === item.id ? { ...x, vote_count: res.voteCount! } : x,
          ),
        );
      }
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma sugestão pública ainda. Seja a primeira.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="flex gap-3 rounded-lg border p-4"
            >
              <button
                type="button"
                onClick={() => toggleVote(item)}
                disabled={pending}
                className={`flex h-fit flex-col items-center rounded-md border px-2 py-1 text-xs ${
                  item.voted
                    ? "border-primary bg-primary/10 text-primary"
                    : "text-muted-foreground hover:border-foreground/30"
                }`}
                aria-pressed={item.voted}
              >
                <ChevronUp className="size-4" />
                {item.vote_count}
              </button>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{item.title}</p>
                  <Badge variant="secondary">
                    {FEATURE_STATUS_LABELS[item.status]}
                  </Badge>
                  {item.is_own ? <Badge variant="outline">Sua org</Badge> : null}
                </div>
                <p className="text-sm text-muted-foreground">{item.problem}</p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-4 rounded-lg border p-4">
        <div>
          <h2 className="text-sm font-semibold">Enviar sugestão</h2>
          <p className="text-xs text-muted-foreground">{VOTE_SCOPE_NOTE}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-title">Título</Label>
          <Input
            id="s-title"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="O que você gostaria de fazer?"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-problem">Qual o problema?</Label>
          <Textarea
            id="s-problem"
            rows={3}
            value={form.problem}
            onChange={(e) => setForm({ ...form, problem: e.target.value })}
            placeholder="O que hoje é difícil ou impossível?"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-usecase">Como você usaria? (opcional)</Label>
          <Textarea
            id="s-usecase"
            rows={2}
            value={form.useCase}
            onChange={(e) => setForm({ ...form, useCase: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>Frequência</Label>
            <Select
              items={FREQ_ITEMS}
              value={form.frequency}
              onValueChange={(v) => setForm({ ...form, frequency: v ?? "sometimes" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQ_ITEMS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Importância</Label>
            <Select
              items={IMP_ITEMS}
              value={form.importance}
              onValueChange={(v) => setForm({ ...form, importance: v ?? "important" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {IMP_ITEMS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          onClick={submit}
          disabled={pending || form.title.trim().length < 4 || form.problem.trim().length < 10}
          className="w-full"
        >
          Enviar
        </Button>
      </div>
    </div>
  );
}
