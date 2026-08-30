import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getSupportOverview,
  listSupportTickets,
} from "@/features/support/admin-queries";
import {
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
  TICKET_PRIORITY_LABELS,
  formatRate,
} from "@/features/support/labels";
import { formatDate } from "@/features/creators/format";

export const metadata: Metadata = { title: "Suporte · Admin" };

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; priority?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const [overview, tickets] = await Promise.all([
    getSupportOverview(),
    listSupportTickets({
      status: sp.status,
      priority: sp.priority,
      type: sp.type,
    }),
  ]);

  const stats = [
    { label: "Conversas", value: overview?.conversations ?? 0 },
    { label: "Resolvidas pela IA", value: overview?.ai_resolved ?? 0 },
    { label: "Encaminhadas", value: overview?.escalated ?? 0 },
    {
      label: "Taxa de resolução IA",
      value: formatRate(overview?.ai_resolution_rate ?? null),
    },
    { label: "Tickets abertos", value: overview?.tickets_open ?? 0 },
    { label: "Críticos abertos", value: overview?.tickets_critical ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Suporte"
        description="Visão geral do assistente e fila de tickets."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">
                {s.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{s.value}</CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href="/admin/support"
          className="rounded-md border px-2 py-1 text-muted-foreground hover:text-foreground"
        >
          Todos
        </Link>
        {(["open", "in_progress", "resolved", "closed"] as const).map((s) => (
          <Link
            key={s}
            href={`/admin/support?status=${s}`}
            className="rounded-md border px-2 py-1 text-muted-foreground hover:text-foreground"
          >
            {TICKET_STATUS_LABELS[s]}
          </Link>
        ))}
        <Link
          href="/admin/support/knowledge"
          className="rounded-md border px-2 py-1 font-medium"
        >
          Base de conhecimento →
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Assunto</TableHead>
            <TableHead>Organização</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Criado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                Nenhum ticket.
              </TableCell>
            </TableRow>
          ) : (
            tickets.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link
                    href={`/admin/support/${t.id}`}
                    className="font-medium hover:underline"
                  >
                    {t.subject}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {t.organization_name}
                </TableCell>
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
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
