import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FolderKanban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/page-header";
import { NewProgramButton } from "@/features/programs/components/new-program-button";
import { DeleteProgramButton } from "@/features/programs/components/delete-program-button";
import { listPrograms } from "@/features/programs/queries";
import {
  PROGRAM_STATUS_LABELS,
  PROGRAM_STATUS_VARIANTS,
} from "@/features/programs/status";

export const metadata: Metadata = { title: "Programas" };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" });

export default async function ProgramsPage() {
  const programs = await listPrograms();

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Programas"
          description="Crie um programa, monte o formulário e publique a URL de captação."
        />
        <NewProgramButton />
      </div>

      {programs.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-surface p-10 text-center">
          <FolderKanban className="mx-auto size-6 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Nenhum programa ainda. Crie o primeiro para começar a captar creators.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Inscrições</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-8" />
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {programs.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/app/programs/${p.id}/general`}
                      className="hover:underline"
                    >
                      {p.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      /{p.slug}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={PROGRAM_STATUS_VARIANTS[p.status]}>
                      {PROGRAM_STATUS_LABELS[p.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {p.application_count}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dateFmt.format(new Date(p.created_at))}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/app/programs/${p.id}/general`}
                      aria-label={`Abrir ${p.name}`}
                    >
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </TableCell>
                  <TableCell>
                    <DeleteProgramButton programId={p.id} programName={p.name} />
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
