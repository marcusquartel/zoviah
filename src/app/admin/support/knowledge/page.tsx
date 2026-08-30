import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { listHelpArticles } from "@/features/support/admin-queries";
import { KnowledgeManager } from "@/features/support/components/knowledge-manager";

export const metadata: Metadata = { title: "Base de conhecimento · Admin" };

export default async function AdminKnowledgePage() {
  const articles = await listHelpArticles();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/support"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Voltar para o suporte
      </Link>
      <PageHeader
        title="Base de conhecimento"
        description="Artigos que o assistente usa para responder. Só artigos publicados são consultados."
      />
      <KnowledgeManager articles={articles} />
    </div>
  );
}
