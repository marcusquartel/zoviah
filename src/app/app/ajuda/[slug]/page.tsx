import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getHelpArticle } from "@/features/support/queries";
import { ArticleBody } from "@/features/support/components/article-body";
import { formatDate } from "@/features/creators/format";

type Params = { slug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getHelpArticle(slug);
  return { title: article ? article.title : "Base de conhecimento" };
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { slug } = await params;
  const article = await getHelpArticle(slug);
  if (!article) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/app/ajuda"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Base de conhecimento
      </Link>

      <div className="space-y-2">
        <Badge variant="secondary">{article.category}</Badge>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          {article.title}
        </h1>
        {article.summary ? (
          <p className="text-sm text-muted-foreground">{article.summary}</p>
        ) : null}
      </div>

      <article className="border-t pt-5">
        <ArticleBody content={article.content} />
      </article>

      <p className="border-t pt-4 text-xs text-muted-foreground">
        Atualizado em {formatDate(article.updated_at)}. Ainda com dúvida? Use o
        botão “Ajuda” no topo para falar com o assistente ou o suporte.
      </p>
    </div>
  );
}
