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
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { PRODUCT } from "@/config/product";
import { LOGIN_PATH } from "@/features/auth/messages";
import { ForgotForm } from "@/app/forgot-password/forgot-form";

export const metadata: Metadata = { title: "Recuperar senha", robots: { index: false } };
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  if (!isSupabaseConfigured()) {
    return <SetupNotice />;
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-surface p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{PRODUCT.name}</CardTitle>
          <CardDescription>Recuperar senha</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ForgotForm />
          <Link
            href={LOGIN_PATH}
            className="block text-center text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            Voltar para entrar
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
