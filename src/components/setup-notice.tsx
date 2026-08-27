import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Shown when Supabase credentials are not present in the environment. */
export function SetupNotice() {
  return (
    <div className="mx-auto flex min-h-svh max-w-lg items-center justify-center p-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuração pendente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            O Creator Hub precisa das credenciais do Supabase para funcionar.
            Crie um arquivo <code className="text-foreground">.env.local</code> na
            raiz do projeto com:
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs text-foreground">
            {`NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...`}
          </pre>
          <p>
            Consulte o <code className="text-foreground">README.md</code> para o
            passo a passo completo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
