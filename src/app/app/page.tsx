import type { Metadata } from "next";
import { Building2, ShieldCheck, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import {
  getCurrentOrganization,
  getCurrentUser,
} from "@/features/organizations/queries";

export const metadata: Metadata = { title: "Visão Geral · Creator Hub" };

export default async function OverviewPage() {
  const [user, current] = await Promise.all([
    getCurrentUser(),
    getCurrentOrganization(),
  ]);

  if (!current) return null;
  const { organization, role } = current;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão Geral"
        description="Fundação do Creator Hub. As áreas de produto serão liberadas nas próximas fases."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Organização</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{organization.name}</p>
            <p className="text-sm text-muted-foreground">/{organization.slug}</p>
            <Badge
              variant={organization.status === "active" ? "secondary" : "outline"}
              className="mt-2 capitalize"
            >
              {organization.status}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Seu acesso</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold capitalize">{role}</p>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Multiempresa</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription>
              Isolamento por <code className="text-foreground">organization_id</code>{" "}
              com Row Level Security ativo no banco.
            </CardDescription>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
