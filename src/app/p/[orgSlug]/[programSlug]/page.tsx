import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ThemeStyle } from "@/components/theme-style";
import { LegalFooter } from "@/components/legal-footer";
import { BrandLogo } from "@/components/brand-logo";
import { getPublicProgram, getPublicProgramLanding } from "@/features/public/queries";
import { LandingPage } from "@/features/public/landing/landing";
import { PublicForm } from "./public-form";

export const dynamic = "force-dynamic";

type Params = { orgSlug: string; programSlug: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { orgSlug, programSlug } = await params;
  const [data, landing] = await Promise.all([
    getPublicProgram(orgSlug, programSlug),
    getPublicProgramLanding(orgSlug, programSlug),
  ]);
  if (!data) return { title: "Inscrição" };
  const title = landing
    ? `${landing.hero.title} · ${data.organization.name}`
    : `${data.program.public_title} · ${data.organization.name}`;
  const description = landing?.hero.subtitle ?? data.program.public_description ?? undefined;
  return {
    title,
    description,
    // A landing is a campaign page meant to be shared; the bare form is not.
    robots: { index: Boolean(landing) },
    openGraph: landing
      ? { title, description, images: landing.hero.image ? [landing.hero.image] : undefined }
      : undefined,
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
  const landing = await getPublicProgramLanding(orgSlug, programSlug);

  const formBlock = isOpen ? (
    <PublicForm
      orgSlug={orgSlug}
      programSlug={programSlug}
      fields={fields}
      successMessage={program.success_message}
    />
  ) : (
    <div className="py-6 text-center">
      <h2 className="font-heading text-lg font-semibold">Inscrições encerradas</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        As inscrições para este programa não estão abertas no momento.
      </p>
    </div>
  );

  if (landing) {
    return (
      <>
        {/* The landing is black & white: buttons follow it, not the app palette. */}
        <ThemeStyle primaryColor="#0a0a0a" secondaryColor={organization.secondary_color} />
        <LandingPage landing={landing} brandName={organization.name} form={formBlock} />
        <div className="bg-white pb-6">
          <LegalFooter />
        </div>
      </>
    );
  }

  return (
    <>
      <ThemeStyle
        primaryColor={organization.primary_color}
        secondaryColor={organization.secondary_color}
      />
      <main className="mx-auto flex min-h-svh w-full max-w-xl flex-col bg-surface px-4 py-10 sm:py-16">
        <header className="mb-8 space-y-3">
          {organization.logo_url ? (
            <BrandLogo
              src={organization.logo_url}
              alt={organization.name}
              size="lg"
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
