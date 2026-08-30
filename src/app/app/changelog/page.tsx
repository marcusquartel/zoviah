import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChangelog } from "@/features/product/queries";
import { formatDate } from "@/features/creators/format";

export const metadata: Metadata = { title: "Novidades" };

export default async function ChangelogPage() {
  const entries = await getChangelog(50);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Novidades"
        description="O que mudou na Zoviah recentemente."
      />
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma novidade publicada ainda.
        </p>
      ) : (
        <div className="space-y-4">
          {entries.map((e) => (
            <Card key={e.id}>
              <CardHeader>
                <CardTitle className="text-base">{e.title}</CardTitle>
                {e.published_at ? (
                  <p className="text-xs text-muted-foreground">
                    {formatDate(e.published_at)}
                  </p>
                ) : null}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {e.summary ? (
                  <p className="font-medium text-foreground">{e.summary}</p>
                ) : null}
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {e.content}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
