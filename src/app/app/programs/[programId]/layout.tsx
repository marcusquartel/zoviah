import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/copy-button";
import { ProgramTabNav } from "@/features/programs/components/tab-nav";
import { getProgram } from "@/features/programs/queries";
import { getCurrentOrganization } from "@/features/organizations/queries";
import {
  PROGRAM_STATUS_LABELS,
  PROGRAM_STATUS_VARIANTS,
} from "@/features/programs/status";

export default async function ProgramLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const [program, current] = await Promise.all([
    getProgram(programId),
    getCurrentOrganization(),
  ]);
  if (!program || !current) notFound();

  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3001";
  const proto = requestHeaders.get("x-forwarded-proto") ?? "http";
  const publicPath = `/p/${current.organization.slug}/${program.slug}`;
  const publicUrl = `${proto}://${host}${publicPath}`;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link
          href="/app/programs"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Programas
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight">
            {program.name}
          </h1>
          <Badge variant={PROGRAM_STATUS_VARIANTS[program.status]}>
            {PROGRAM_STATUS_LABELS[program.status]}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">URL pública:</span>
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
            {publicPath}
          </code>
          <CopyButton value={publicUrl} label="Copiar URL" />
          {program.status === "active" ? (
            <Link
              href={publicPath}
              target="_blank"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              Abrir <ExternalLink className="size-3.5" />
            </Link>
          ) : (
            <span className="text-xs text-muted-foreground">
              (disponível quando o programa estiver ativo)
            </span>
          )}
        </div>
      </div>

      <ProgramTabNav programId={programId} />

      <div>{children}</div>
    </div>
  );
}
