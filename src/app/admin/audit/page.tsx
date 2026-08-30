import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/features/creators/format";
import { listPlatformAudit } from "@/features/platform/queries";

export const metadata: Metadata = { title: "Admin SaaS · Auditoria" };

const EVENT_LABELS: Record<string, string> = {
  organization_created: "Organização criada",
  organization_suspended: "Organização suspensa",
  organization_reactivated: "Organização reativada",
  organization_plan_changed: "Plano alterado",
};

export default async function AdminAuditPage() {
  const { items } = await listPlatformAudit(1);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Auditoria da plataforma"
        description="Ações administrativas (criação, suspensão, mudança de plano). Sem PII."
      />
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-surface p-10 text-center text-sm text-muted-foreground">
          Nenhum evento registrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Organização</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDateTime(e.created_at)}
                  </TableCell>
                  <TableCell className="text-sm">
                    {EVENT_LABELS[e.event_type] ?? e.event_type}
                  </TableCell>
                  <TableCell className="text-sm">
                    {e.organization_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {e.actor_email ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {e.metadata && Object.keys(e.metadata).length > 0
                      ? Object.entries(e.metadata)
                          .map(([k, v]) => `${k}: ${String(v)}`)
                          .join(" · ")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
