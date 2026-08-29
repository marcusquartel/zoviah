import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProgram, listApplications } from "@/features/programs/queries";

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function ProgramApplicationsPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const program = await getProgram(programId);
  if (!program) notFound();

  const { rows, total } = await listApplications(programId);

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold tabular-nums">{total}</span>
        <span className="text-sm text-muted-foreground">
          {total === 1 ? "inscrição recebida" : "inscrições recebidas"}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        A gestão completa das inscrições (revisão, aprovação, Kanban) chega na
        Fase 2. Aqui é só a confirmação de que os cadastros estão chegando.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-surface p-8 text-center text-sm text-muted-foreground">
          Nenhuma inscrição ainda.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Creator</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Enviada em</TableHead>
                <TableHead>Form</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium">
                    <Link
                      href={`/app/creators?a=${r.id}`}
                      className="hover:underline"
                    >
                      {r.creator_name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.creator_email ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dateFmt.format(new Date(r.submitted_at))}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    v{r.form_version}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {total > rows.length ? (
        <p className="text-xs text-muted-foreground">
          Mostrando as {rows.length} inscrições mais recentes.
        </p>
      ) : null}
    </div>
  );
}
