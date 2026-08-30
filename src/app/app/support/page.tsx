import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getMyTickets } from "@/features/support/queries";
import {
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
  TICKET_PRIORITY_LABELS,
} from "@/features/support/labels";
import { formatDate } from "@/features/creators/format";

export const metadata: Metadata = { title: "Minhas solicitações" };

export default async function MySupportPage() {
  const tickets = await getMyTickets();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Minhas solicitações"
        description="Tickets que você abriu com o suporte."
      />
      {tickets.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Você não tem solicitações abertas. Use o botão “Ajuda” no topo para
          falar com o assistente.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Assunto</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aberto em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tickets.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.subject}</TableCell>
                <TableCell>{TICKET_TYPE_LABELS[t.type]}</TableCell>
                <TableCell>{TICKET_PRIORITY_LABELS[t.priority]}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {TICKET_STATUS_LABELS[t.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(t.created_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
