import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getAllHelpArticles } from "@/features/support/queries";
import { KnowledgeBase } from "@/features/support/components/knowledge-base";

export const metadata: Metadata = { title: "Base de conhecimento" };

export default async function KnowledgeBasePage() {
  const articles = await getAllHelpArticles();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Base de conhecimento"
        description="Busque por assunto ou navegue pelas categorias. Para perguntas específicas, use o assistente no botão “Ajuda”."
      />
      <KnowledgeBase allArticles={articles} />
    </div>
  );
}
