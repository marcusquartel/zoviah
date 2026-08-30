import Link from "next/link";
import { PauseCircle } from "lucide-react";
import { UserMenu } from "@/components/app-shell/user-menu";

/** Shown instead of the app when the current organization is suspended (§31). */
export function SuspendedNotice({
  orgName,
  userEmail,
  isPlatformAdmin,
}: {
  orgName: string;
  userEmail: string;
  isPlatformAdmin: boolean;
}) {
  return (
    <div className="min-h-svh bg-surface">
      <header className="flex h-14 items-center justify-between border-b bg-background px-4">
        <span className="text-sm font-medium">{orgName}</span>
        <UserMenu email={userEmail} role="—" />
      </header>
      <main className="mx-auto flex max-w-md flex-col items-center justify-center gap-3 px-6 py-24 text-center">
        <PauseCircle className="size-10 text-warning-foreground" />
        <h1 className="text-lg font-semibold">Acesso suspenso</h1>
        <p className="text-sm text-muted-foreground">
          O acesso da organização <strong>{orgName}</strong> ao painel está
          suspenso no momento. Seus dados foram preservados. Entre em contato com
          o suporte para reativar.
        </p>
        {isPlatformAdmin ? (
          <Link
            href="/admin"
            className="text-sm text-primary hover:underline"
          >
            Abrir Admin SaaS
          </Link>
        ) : null}
      </main>
    </div>
  );
}
