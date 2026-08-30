import type { Metadata } from "next";
import { ThemeStyle } from "@/components/theme-style";
import { LegalFooter } from "@/components/legal-footer";
import { hashToken } from "@/lib/secure-token";
import { getPublicAddressRequest } from "@/features/requests/queries";
import { AddressForm } from "./address-form";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Complete seus dados",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type Params = { token: string };

const INVALID_MESSAGE = "Este link não está mais disponível ou expirou.";

export default async function CompleteAddressPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { token } = await params;
  const request = await getPublicAddressRequest(hashToken(token));

  if (request.status === "invalid") {
    return <Outcome title="Link indisponível" body={INVALID_MESSAGE} />;
  }

  if (request.status === "completed") {
    return (
      <>
        <Branding org={request.organization} />
        <Outcome
          title="Dados já enviados"
          body="Seus dados já foram enviados. A equipe dará continuidade ao processo."
          org={request.organization}
        />
      </>
    );
  }

  return (
    <>
      <ThemeStyle
        primaryColor={request.organization.primary_color}
        secondaryColor={request.organization.secondary_color}
      />
      <main className="mx-auto w-full max-w-md px-4 py-8 sm:py-14">
        <header className="mb-6 space-y-2">
          {request.organization.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={request.organization.logo_url}
              alt={request.organization.name}
              className="h-9 w-auto"
            />
          ) : (
            <p className="text-sm font-medium text-muted-foreground">
              {request.organization.name}
            </p>
          )}
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Complete seus dados para envio
          </h1>
          <p className="text-sm text-muted-foreground">
            Precisamos destas informações para prosseguir com o envio
            relacionado à parceria
            {request.program_name ? ` — ${request.program_name}` : ""}.
          </p>
        </header>

        <AddressForm token={token} />

        <p className="mt-8 text-center text-xs text-muted-foreground">
          {request.organization.name}
        </p>
        <LegalFooter className="mt-2 text-center text-xs text-muted-foreground" />
      </main>
    </>
  );
}

function Branding({
  org,
}: {
  org: { primary_color: string | null; secondary_color: string | null };
}) {
  return (
    <ThemeStyle
      primaryColor={org.primary_color}
      secondaryColor={org.secondary_color}
    />
  );
}

function Outcome({
  title,
  body,
  org,
}: {
  title: string;
  body: string;
  org?: { name: string; logo_url: string | null };
}) {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      {org?.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={org.logo_url} alt={org.name} className="mb-6 h-9 w-auto" />
      ) : null}
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </main>
  );
}
