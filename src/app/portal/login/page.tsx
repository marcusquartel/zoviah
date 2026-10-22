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
import { LoginForm } from "@/app/login/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getCurrentUser } from "@/features/organizations/queries";

export const metadata: Metadata = { title: "Portal da creator" };

export default async function PortalLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const sp = await searchParams;
  const next =
    typeof sp.next === "string" && sp.next.startsWith("/portal") && !sp.next.startsWith("//")
      ? sp.next
      : "/portal";

  if (await getCurrentUser()) redirect(next);

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Portal da creator</CardTitle>
          <CardDescription>
            Entre com o e-mail e a senha que você criou pelo convite da marca.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm next={next} />
        </CardContent>
      </Card>
    </div>
  );
}
