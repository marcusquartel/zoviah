"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchKnowledgeBase } from "@/features/support/kb-actions";
import type {
  HelpArticleHit,
  HelpArticleSummary,
} from "@/features/support/queries";

function ArticleRow({
  slug,
  title,
  summary,
  category,
}: {
  slug: string;
  title: string;
  summary: string | null;
  category: string;
}) {
  return (
    <Link
      href={`/app/ajuda/${slug}`}
      className="block rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <p className="text-sm font-medium">{title}</p>
      {summary ? (
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
          {summary}
        </p>
      ) : null}
      <p className="mt-1 text-[0.6875rem] uppercase tracking-wide text-muted-foreground/70">
        {category}
      </p>
    </Link>
  );
}

export function KnowledgeBase({
  allArticles,
}: {
  allArticles: HelpArticleSummary[];
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<{ q: string; items: HelpArticleHit[] } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const mine = ++seq.current;
    const t = setTimeout(() => {
      startTransition(async () => {
        const items = await searchKnowledgeBase(q);
        if (seq.current === mine) setHits({ q, items });
      });
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const results = hits && hits.q === query.trim() ? hits.items : null;

  const byCategory = useMemo(() => {
    const map = new Map<string, HelpArticleSummary[]>();
    for (const a of allArticles) {
      const list = map.get(a.category) ?? [];
      list.push(a);
      map.set(a.category, list);
    }
    return [...map.entries()];
  }, [allArticles]);

  const searching = query.trim().length >= 2;

  return (
    <div className="space-y-6">
      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por assunto — ex.: endereço, CPF, aprovar creator"
          className="pl-9"
          autoFocus
        />
      </div>

      {searching ? (
        <div className="space-y-2">
          {pending && results === null ? (
            <p className="text-sm text-muted-foreground">Buscando…</p>
          ) : results && results.length > 0 ? (
            <>
              <p className="text-xs text-muted-foreground">
                {results.length} artigo{results.length > 1 ? "s" : ""}
              </p>
              {results.map((a) => (
                <ArticleRow
                  key={a.id}
                  slug={a.slug}
                  title={a.title}
                  summary={a.summary}
                  category={a.category}
                />
              ))}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum artigo encontrado. Tente outras palavras ou use o botão
              “Ajuda” no topo para falar com o assistente.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {byCategory.map(([category, articles]) => (
            <section key={category} className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {category}
              </h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {articles.map((a) => (
                  <ArticleRow
                    key={a.id}
                    slug={a.slug}
                    title={a.title}
                    summary={a.summary}
                    category={a.category}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
