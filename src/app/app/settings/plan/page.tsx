import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import { PLAN_LABELS } from "@/features/platform/plans";
import { formatDate } from "@/features/creators/format";
import type { PlanCode } from "@/types/database";

export const metadata: Metadata = { title: "Plano" };

export default async function PlanPage() {
  const current = await getCurrentOrganization();
  if (!current) return null;

  const supabase = await createClient();
  const { data: sub } = await supabase
    .from("organization_subscriptions")
    .select("plan_code, started_at, expires_at")
    .eq("organization_id", current.organization.id)
    .maybeSingle();

  const plan = (sub?.plan_code ?? "founding") as PlanCode;

  return (
    <div className="space-y-6">
      <PageHeader title="Plano" description="Condição comercial da organização." />
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Plano atual</CardTitle>
          <CardDescription>
            Alterações de plano são feitas pela equipe Zoviah.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p className="text-2xl font-semibold">{PLAN_LABELS[plan]}</p>
          {sub?.started_at ? (
            <p className="text-muted-foreground">
              Desde {formatDate(sub.started_at)}
              {sub.expires_at ? ` · expira ${formatDate(sub.expires_at)}` : ""}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
