import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { listFeatureRequests } from "@/features/product/queries";
import { SuggestionsBoard } from "@/features/product/components/suggestions-board";

export const metadata: Metadata = { title: "Sugestões" };

export default async function SuggestionsPage() {
  const items = await listFeatureRequests();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sugestões"
        description="Proponha melhorias e vote nas ideias que mais importam para a sua operação."
      />
      <SuggestionsBoard initial={items} />
    </div>
  );
}
