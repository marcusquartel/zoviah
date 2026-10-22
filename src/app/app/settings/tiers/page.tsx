import type { Metadata } from "next";
import { Layers } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { getTiers } from "@/features/tiers/queries";
import { TiersManager } from "@/features/tiers/components/tiers-manager";

export const metadata: Metadata = { title: "Categorias" };

export default async function TiersPage() {
  const current = await getCurrentOrganization();
  if (!current) return null;

  const tiers = await getTiers(current.organization.id);
  const canEdit = current.role === "owner" || current.role === "admin";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categorias"
        description="Níveis de creators e a comissão de cada um."
      />
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Categorias de creators</CardTitle>
          </div>
          <CardDescription>
            Cada creator pode estar em uma categoria (aba Comissão do detalhe da
            creator). A comissão individual, quando preenchida, tem prioridade
            sobre a da categoria.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TiersManager tiers={tiers} canEdit={canEdit} />
        </CardContent>
      </Card>
    </div>
  );
}
