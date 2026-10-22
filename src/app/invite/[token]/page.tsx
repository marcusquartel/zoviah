import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { hashToken } from "@/lib/secure-token";
import { getCurrentUser } from "@/features/organizations/queries";
import { getPublicInvite } from "@/features/team/queries";
import { AcceptInvite } from "./accept-invite";
import { InviteSignup } from "./invite-signup";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Convite",
  robots: { index: false },
};

type Params = { token: string };
type SearchParams = { code?: string; error?: string };

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await params;
  const { code, error } = await searchParams;

  // Confirmation links sent before the redirect moved to /auth/callback land
  // here with a PKCE `?code=`. Only the route handler can write the session
  // cookie, so hand the code over.
  if (code) {
    const to = new URLSearchParams({ code, next: `/invite/${token}` });
    redirect(`/auth/callback?${to.toString()}`);
  }

  const invite = await getPublicInvite(hashToken(token));

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface p-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6">
        {invite.status === "invalid" ? (
          <Outcome
            title="Convite indisponível"
            body="Este convite não está mais disponível ou expirou. Peça um novo à equipe."
          />
        ) : invite.status === "accepted" ? (
          <Outcome
            title="Convite já aceito"
            body={`Você já faz parte de ${invite.organization_name}.`}
            action={<AppLink />}
          />
        ) : (
          <PendingInvite
            token={token}
            invite={invite}
            confirmFailed={Boolean(error)}
          />
        )}
      </div>
    </div>
  );
}

async function PendingInvite({
  token,
  invite,
  confirmFailed,
}: {
  token: string;
  confirmFailed: boolean;
  invite: {
    organization_name: string;
    role: string;
    email_masked: string;
  };
}) {
  const user = await getCurrentUser();

  return (
    <div className="space-y-4 text-center">
      <div>
        <h1 className="text-lg font-semibold">
          Convite para {invite.organization_name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Papel: {roleLabel(invite.role)} · para {invite.email_masked}
        </p>
      </div>

      {user ? (
        <AcceptInvite token={token} userEmail={user.email ?? ""} />
      ) : (
        <InviteSignup
          token={token}
          emailMasked={invite.email_masked}
          startInLogin={confirmFailed}
          loginHref={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
        />
      )}
    </div>
  );
}

function roleLabel(role: string): string {
  return { owner: "Owner", admin: "Admin", analyst: "Analyst" }[role] ?? role;
}

function AppLink() {
  return (
    <Link href="/app" className="text-sm text-primary hover:underline">
      Ir para o painel
    </Link>
  );
}

function Outcome({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="space-y-2 text-center">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}
