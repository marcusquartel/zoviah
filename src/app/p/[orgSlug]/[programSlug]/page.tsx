import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ThemeStyle } from "@/components/theme-style";
import { LegalFooter } from "@/components/legal-footer";
import { getPublicProgram } from "@/features/public/queries";
import { PublicForm } from "./public-form";

export const dynamic = "force-dynamic";

type Params = { orgSlug: string; programSlug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { orgSlug, programSlug } = await params;
  const data = await getPublicProgram(orgSlug, programSlug);
  if (!data) return { title: "Inscrição" };
  return {
    title: `${data.program.public_title} · ${data.organization.name}`,
    description: data.program.public_description ?? undefined,
    robots: { index: false },
  };
}

export default async function PublicProgramPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { orgSlug, programSlug } = await params;
  const data = await getPublicProgram(orgSlug, programSlug);
  if (!data) notFound();

  const { organization, program, fields } = data;
  const isOpen = program.status === "active";

  return (
    <>
      <ThemeStyle
        primaryColor={organization.primary_color}
        secondaryColor={organization.secondary_color}
      />
      <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col bg-surface px-4 py-10 sm:py-16">
        <header className="mb-8 space-y-3">
          {organization.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organization.logo_url}
              alt={organization.name}
              className="h-12 w-auto max-w-[220px] object-contain"
            />
          ) : (
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {organization.name}
            </p>
          )}
          <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
            {program.public_title}
          </h1>
          {program.public_description ? (
            <p className="whitespace-pre-line text-sm text-muted-foreground">
              {program.public_description}
            </p>
          ) : null}
        </header>

        {isOpen ? (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
            <PublicForm
              orgSlug={orgSlug}
              programSlug={programSlug}
              fields={fields}
              successMessage={program.success_message}
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
            <h2 className="font-heading text-lg font-semibold">
              Inscrições encerradas
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              As inscrições para este programa não estão abertas no momento.
            </p>
          </div>
        )}

        <p className="mt-auto pt-10 text-center text-xs text-muted-foreground">
          {organization.name} · Zoviah
        </p>
        <LegalFooter />
      </main>
    </>
  );
}
