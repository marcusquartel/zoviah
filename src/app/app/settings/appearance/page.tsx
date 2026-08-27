import type { Metadata } from "next";
import { Palette } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { AppearanceForm } from "@/app/app/settings/appearance/appearance-form";
import { getCurrentOrganization } from "@/features/organizations/queries";

export const metadata: Metadata = { title: "Aparência · Creator Hub" };

export default async function AppearancePage() {
  const current = await getCurrentOrganization();
  if (!current) return null;

  const { settings, role } = current;
  const canEdit = role === "owner" || role === "admin";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aparência"
        description="Identidade visual da organização (white label)."
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Marca</CardTitle>
          </div>
          <CardDescription>
            As cores são aplicadas aos tokens de tema em toda a aplicação.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-md border border-dashed bg-surface p-4 text-sm text-muted-foreground">
            Upload de logo e favicon será habilitado em uma fase futura. Por
            enquanto, apenas as cores são persistidas.
          </div>
          <AppearanceForm
            primaryColor={settings?.primary_color ?? ""}
            secondaryColor={settings?.secondary_color ?? ""}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
