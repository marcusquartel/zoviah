import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SetupNotice } from "@/components/setup-notice";
import { ThemeStyle } from "@/components/theme-style";
import { LoginForm } from "@/app/login/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentUser } from "@/features/organizations/queries";
import { getTenantBrandingFromHost } from "@/features/tenant/branding";
import { PRODUCT } from "@/config/product";
import {
  PASSWORD_RESET_SUCCESS_PARAM,
  PASSWORD_RESET_SUCCESS_VALUE,
  PASSWORD_RESET_SUCCESS_MESSAGE,
} from "@/features/auth/messages";

export const metadata: Metadata = { title: "Entrar" };

// Reads the session cookie to bounce already-authenticated users.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const sp = await searchParams;
  const next =
    typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//")
      ? sp.next
      : undefined;
  const passwordResetOk =
    sp[PASSWORD_RESET_SUCCESS_PARAM] === PASSWORD_RESET_SUCCESS_VALUE;

  const [user, branding] = await Promise.all([
    getCurrentUser(),
    getTenantBrandingFromHost(),
  ]);
  if (user) {
    redirect(next ?? "/app");
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface p-6">
      {branding ? (
        <ThemeStyle
          primaryColor={branding.primaryColor}
          secondaryColor={branding.secondaryColor}
        />
      ) : null}
      <Card className="w-full max-w-sm">
        <CardHeader>
          {branding?.logoUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={branding.logoUrl}
                alt={branding.name}
                className="mb-1 h-9 w-auto max-w-[180px] object-contain"
              />
              <CardDescription>
                Acesse o painel de {branding.name}.
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle>{branding?.name ?? PRODUCT.name}</CardTitle>
              <CardDescription>Acesse o painel administrativo.</CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {passwordResetOk ? (
            <p
              className="rounded-md border border-success/30 bg-success/5 px-3 py-2 text-sm text-success"
              role="status"
            >
              {PASSWORD_RESET_SUCCESS_MESSAGE}
            </p>
          ) : null}
          <LoginForm next={next} />
        </CardContent>
      </Card>
    </div>
  );
}
