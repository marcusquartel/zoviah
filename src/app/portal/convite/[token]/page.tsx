import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { hashToken } from "@/lib/secure-token";
import { getCurrentUser } from "@/features/organizations/queries";
import { getPortalInvite } from "@/features/portal/queries";
import { PortalSignup } from "@/features/portal/components/portal-signup";
import { AcceptPortal } from "@/features/portal/components/accept-portal";

export const metadata: Metadata = { title: "Convite — portal da creator", robots: { index: false } };

export default async function PortalInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ code?: string; error?: string }>;
}) {
  const { token } = await params;
  const { code, error } = await searchParams;

  // A PKCE confirmation link that skipped the callback: hand the code over.
  if (code) {
    const to = new URLSearchParams({ code, next: `/portal/convite/${token}` });
    redirect(`/auth/callback?${to.toString()}`);
  }

  const invite = await getPortalInvite(hashToken(token));
  const loginHref = `/portal/login?next=${encodeURIComponent(`/portal/convite/${token}`)}`;

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-center">
        {invite.status === "invalid" ? (
          <div className="space-y-2">
            <h1 className="text-lg font-semibold">Convite indisponível</h1>
            <p className="text-sm text-muted-foreground">
              Este convite expirou ou foi cancelado. Peça um novo à marca.
            </p>
            <Link href="/portal/login" className="text-sm text-primary hover:underline">
              Já tenho acesso
            </Link>
          </div>
        ) : invite.status === "accepted" ? (
          <div className="space-y-2">
            <h1 className="text-lg font-semibold">Portal já ativado</h1>
            <p className="text-sm text-muted-foreground">Entre com seu e-mail e senha.</p>
            <Link href="/portal" className="text-sm text-primary hover:underline">
              Ir para o portal
            </Link>
          </div>
        ) : (
          <PendingInvite
            token={token}
            invite={invite}
            loginHref={loginHref}
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
  loginHref,
  confirmFailed,
}: {
  token: string;
  invite: { organization_name?: string; creator_name?: string; email_masked?: string };
  loginHref: string;
  confirmFailed: boolean;
}) {
  const user = await getCurrentUser();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Oi, {invite.creator_name}!</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Seu portal de creator da {invite.organization_name} · {invite.email_masked}
        </p>
      </div>
      {user ? (
        <AcceptPortal token={token} userEmail={user.email ?? ""} />
      ) : (
        <PortalSignup
          token={token}
          emailMasked={invite.email_masked ?? ""}
          loginHref={loginHref}
          startInLogin={confirmFailed}
        />
      )}
    </div>
  );
}
