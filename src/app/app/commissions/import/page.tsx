import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { getShopifyStatus } from "@/features/shopify/queries";
import { ImportCodes } from "@/features/commissions/components/import-codes";

export const metadata: Metadata = { title: "Importar cupons" };

export default async function ImportCodesPage() {
  const current = await getCurrentOrganization();
  if (!current) return null;
  if (current.role === "analyst") redirect("/app/commissions");
  const status = await getShopifyStatus(current.organization.id);
  if (!status) redirect("/app/shopify");

  return (
    <div className="space-y-4">
      <div className="pb-4">
        <PageHeader
          title="Importar cupons da loja"
          description="Escolha os cupons que já são de influenciadoras. Cada uma vira uma creator aprovada, com o cupom vinculado e as vendas anteriores atribuídas."
        />
      </div>
      <ImportCodes />
    </div>
  );
}
