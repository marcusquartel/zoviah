import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { getSupportTicket } from "@/features/support/admin-queries";
import { TicketDetail } from "@/features/support/components/ticket-detail";

export const metadata: Metadata = { title: "Ticket · Admin" };

export default async function AdminTicketPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const ticket = await getSupportTicket(ticketId);
  if (!ticket) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/admin/support"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Voltar para a fila
      </Link>
      <PageHeader title="Ticket" description={ticket.id} />
      <TicketDetail ticket={ticket} />
    </div>
  );
}
