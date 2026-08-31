import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SetupNotice } from "@/components/setup-notice";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { PRODUCT } from "@/config/product";
import { confirmRecovery } from "@/features/auth/actions";
import { isAllowedOtpType, safeNextPath } from "@/features/auth/callback";
import {
  FORGOT_PASSWORD_PATH,
  RECOVERY_LINK_INVALID_MESSAGE,
} from "@/features/auth/messages";

export const metadata: Metadata = {
  title: "Confirmar recuperação",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
// A GET here must NEVER verify the OTP — that is what makes the flow
// prefetch-safe. The token is only consumed by the POST below.
export const dynamic = "force-dynamic";

export default async function RecoverConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{
    token_hash?: string;
    type?: string;
    next?: string;
  }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const sp = await searchParams;
  const tokenHash = typeof sp.token_hash === "string" ? sp.token_hash : "";
  const type = typeof sp.type === "string" ? sp.type : "";
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  const usable = Boolean(tokenHash) && isAllowedOtpType(type);

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{PRODUCT.name}</CardTitle>
          <CardDescription>Recuperação de senha</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {usable ? (
            <>
              <p className="text-sm text-muted-foreground">
                Confirme que é você para continuar a redefinir sua senha.
              </p>
              <form action={confirmRecovery}>
                <input type="hidden" name="token_hash" value={tokenHash} />
                <input type="hidden" name="type" value={type} />
                <input type="hidden" name="next" value={next} />
                <Button type="submit" className="w-full">
                  Continuar recuperação
                </Button>
              </form>
            </>
          ) : (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                {RECOVERY_LINK_INVALID_MESSAGE}
              </p>
              <Link
                href={FORGOT_PASSWORD_PATH}
                className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Solicitar novo link
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
