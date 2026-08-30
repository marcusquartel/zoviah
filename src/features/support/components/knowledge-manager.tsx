"use client";

import { useState, useTransition } from "react";
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
import { upsertHelpArticle } from "@/features/support/admin-actions";
import { ARTICLE_STATUS_LABELS, HELP_CATEGORIES } from "@/features/support/labels";
import type { HelpArticle } from "@/types/database";

const CATEGORY_ITEMS = HELP_CATEGORIES.map((c) => ({ value: c, label: c }));
const STATUS_ITEMS = (
  Object.entries(ARTICLE_STATUS_LABELS) as [string, string][]
).map(([value, label]) => ({ value, label }));

type Draft = {
  id: string | null;
  category: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  keywords: string;
  status: string;
};

const EMPTY: Draft = {
  id: null,
  category: "Creators",
  title: "",
  slug: "",
  summary: "",
  content: "",
  keywords: "",
  status: "draft",
};

function toDraft(a: HelpArticle): Draft {
  return {
    id: a.id,
    category: a.category,
    title: a.title,
    slug: a.slug,
    summary: a.summary ?? "",
    content: a.content,
    keywords: a.keywords.join(", "),
    status: a.status,
  };
}

export function KnowledgeManager({ articles }: { articles: HelpArticle[] }) {
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await upsertHelpArticle({
        id: draft.id,
        category: draft.category,
        title: draft.title,
        slug: draft.slug,
        summary: draft.summary || null,
        content: draft.content,
        keywords: draft.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        status: draft.status,
      });
      if (res.ok) {
        toast.success(draft.id ? "Artigo atualizado." : "Artigo criado.");
        setDraft(EMPTY);
      } else {
        toast.error(res.error ?? "Falha ao salvar.");
      }
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="space-y-2">
        {articles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum artigo ainda.</p>
        ) : (
          articles.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setDraft(toDraft(a))}
              className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <span>
                <span className="font-medium">{a.title}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {a.category}
                </span>
              </span>
              <Badge variant={a.status === "published" ? "secondary" : "outline"}>
                {ARTICLE_STATUS_LABELS[a.status]}
              </Badge>
            </button>
          ))
        )}
      </div>

      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            {draft.id ? "Editar artigo" : "Novo artigo"}
          </h2>
          {draft.id ? (
            <Button variant="ghost" size="sm" onClick={() => setDraft(EMPTY)}>
              Novo
            </Button>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select
              items={CATEGORY_ITEMS}
              value={draft.category}
              onValueChange={(v) =>
                setDraft({ ...draft, category: v ?? "Creators" })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_ITEMS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              items={STATUS_ITEMS}
              value={draft.status}
              onValueChange={(v) => setDraft({ ...draft, status: v ?? "draft" })}
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
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="k-title">Título</Label>
          <Input
            id="k-title"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="k-slug">Slug</Label>
          <Input
            id="k-slug"
            value={draft.slug}
            onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
            placeholder="como-solicitar-endereco"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="k-summary">Resumo</Label>
          <Textarea
            id="k-summary"
            rows={2}
            value={draft.summary}
            onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="k-content">Conteúdo</Label>
          <Textarea
            id="k-content"
            rows={8}
            value={draft.content}
            onChange={(e) => setDraft({ ...draft, content: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="k-keywords">Palavras-chave (vírgula)</Label>
          <Input
            id="k-keywords"
            value={draft.keywords}
            onChange={(e) => setDraft({ ...draft, keywords: e.target.value })}
          />
        </div>
        <Button
          onClick={save}
          disabled={
            pending ||
            draft.title.trim().length < 3 ||
            draft.content.trim().length < 10
          }
          className="w-full"
        >
          Salvar
        </Button>
      </div>
    </div>
  );
}
