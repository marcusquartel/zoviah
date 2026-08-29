"use client";

import { useCallback, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CreatorTable } from "@/features/creators/components/creator-table";
import { CreatorKanban } from "@/features/creators/components/creator-kanban";
import { CreatorModal } from "@/features/creators/components/creator-modal";
import { loadMoreApplications } from "@/features/creators/data-actions";
import type {
  CreatorQuery,
  CreatorView,
} from "@/lib/query-state";
import { serializeCreatorQuery } from "@/lib/query-state";
import type { ApplicationListItem, ApplicationStatus } from "@/types/database";
import type { ApplicationListPage } from "@/features/creators/queries";

interface ResultsProps {
  view: CreatorView;
  query: CreatorQuery;
  firstPage: ApplicationListPage;
}

export function CreatorsResults({ view, query, firstPage }: ResultsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ApplicationListItem[]>(firstPage.items);
  const [page, setPage] = useState(firstPage.page);
  const [hasMore, setHasMore] = useState(firstPage.hasMore);
  const [loadingMore, startLoadMore] = useTransition();

  // The open creator is URL state (`?a=<applicationId>`) so it can be
  // deep-linked from any other creator listing.
  const selectedId = searchParams.get("a");
  const setSelectedId = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams);
      if (id) next.set("a", id);
      else next.delete("a");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  const search = serializeCreatorQuery({ ...query, page: 1, view: "list" });

  function patchStatus(applicationId: string, to: ApplicationStatus) {
    setItems((prev) =>
      prev.map((it) => (it.id === applicationId ? { ...it, status: to } : it)),
    );
  }

  function afterMutation() {
    // Pull fresh server data (counts, ordering, revalidated cache).
    router.refresh();
  }

  function loadMore() {
    startLoadMore(async () => {
      const next = await loadMoreApplications(search, page + 1);
      setItems((prev) => [...prev, ...next.items]);
      setPage(next.page);
      setHasMore(next.hasMore);
    });
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-surface p-10 text-center text-sm text-muted-foreground">
          Nenhuma inscrição encontrada com os filtros atuais.
        </div>
      ) : view === "kanban" ? (
        <CreatorKanban
          items={items}
          onSelect={setSelectedId}
          onMove={(id, to) => {
            patchStatus(id, to);
            afterMutation();
          }}
        />
      ) : (
        <CreatorTable
          items={items}
          onSelect={setSelectedId}
          onStatusChanged={(id, to) => {
            patchStatus(id, to);
            afterMutation();
          }}
        />
      )}

      {view === "list" && hasMore ? (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Carregando…" : "Carregar mais"}
          </Button>
        </div>
      ) : null}

      <CreatorModal
        applicationId={selectedId}
        onClose={() => setSelectedId(null)}
        onStatusChanged={afterMutation}
      />
    </div>
  );
}
