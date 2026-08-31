import type { Metadata } from "next";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SetupNotice } from "@/components/setup-notice";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { PRODUCT } from "@/config/product";
import {
  FORGOT_PASSWORD_PATH,
  recoveryErrorMessage,
} from "@/features/auth/messages";
import { ResetForm } from "@/app/reset-password/reset-form";

export const metadata: Metadata = {
  title: "Nova senha",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  const { error } = await searchParams;

  // The recovery session (if any) was set by the /recover/confirm POST
  // (verifyOtp). No token is read from this page's URL.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{PRODUCT.name}</CardTitle>
          <CardDescription>Definir nova senha</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {user ? (
            <ResetForm />
          ) : (
            <div className="space-y-3 text-center">
              <p className="text-sm text-muted-foreground">
                {recoveryErrorMessage(error)}
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
