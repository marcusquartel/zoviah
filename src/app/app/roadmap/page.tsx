import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getRoadmap } from "@/features/product/queries";
import {
  ROADMAP_STATUS_LABELS,
  ROADMAP_STATUS_ORDER,
} from "@/features/product/labels";

export const metadata: Metadata = { title: "Roadmap · Creator Hub" };

// §39 — the roadmap shows direction, never a date or a promised deadline.
export default async function RoadmapPage() {
  const items = await getRoadmap();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roadmap"
        description="Em que estamos trabalhando. Sem datas — as prioridades mudam."
      />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {ROADMAP_STATUS_ORDER.map((status) => {
          const group = items.filter((i) => i.status === status);
          return (
            <div key={status} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {ROADMAP_STATUS_LABELS[status]}
              </h2>
              {group.length === 0 ? (
                <p className="text-xs text-muted-foreground/60">—</p>
              ) : (
                group.map((i) => (
                  <Card key={i.id}>
                    <CardHeader>
                      <CardTitle className="text-sm">{i.title}</CardTitle>
                    </CardHeader>
                    {i.summary ? (
                      <CardContent className="text-sm text-muted-foreground">
                        {i.summary}
                      </CardContent>
                    ) : null}
                  </Card>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
