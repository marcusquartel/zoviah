import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import {
  listFeatureRequestsAdmin,
  listRoadmapItemsAdmin,
  listChangelogEntriesAdmin,
} from "@/features/product/admin-queries";
import { ProductAdmin } from "@/features/product/components/product-admin";

export const metadata: Metadata = { title: "Produto · Admin" };

export default async function AdminProductPage() {
  const [requests, roadmap, changelog] = await Promise.all([
    listFeatureRequestsAdmin(),
    listRoadmapItemsAdmin(),
    listChangelogEntriesAdmin(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Produto"
        description="Triagem de sugestões, roadmap público e novidades."
      />
      <ProductAdmin
        requests={requests}
        roadmap={roadmap}
        changelog={changelog}
      />
    </div>
  );
}
