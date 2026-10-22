"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { loadCreatorContent } from "@/features/creators/data-actions";
import { ContentFormDialog } from "@/features/content/components/content-form";
import { ContentReviewList } from "@/features/content/components/review-list";
import type { StaffContentRow } from "@/features/content/queries";

export function CreatorContentTab({ creatorId }: { creatorId: string }) {
  const [rows, setRows] = useState<StaffContentRow[] | null>(null);
  const [open, setOpen] = useState(false);

  const reload = useCallback(() => {
    void loadCreatorContent(creatorId).then(setRows);
  }, [creatorId]);

  useEffect(() => {
    let active = true;
    void loadCreatorContent(creatorId).then((r) => {
      if (active) setRows(r);
    });
    return () => {
      active = false;
    };
  }, [creatorId]);

  if (!rows) return <Skeleton className="h-40 w-full" />;

  const approved = rows.filter((r) => r.status === "approved").length;
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {approved} {approved === 1 ? "publicação aprovada" : "publicações aprovadas"} no total
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Registrar
        </Button>
      </div>
      <ContentReviewList rows={rows} showCreator={false} canReview onChanged={reload} />
      <ContentFormDialog creatorId={creatorId} mode="staff" open={open} onOpenChange={setOpen} onSaved={reload} />
    </div>
  );
}
