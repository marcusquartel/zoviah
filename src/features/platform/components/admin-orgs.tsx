"use client";

import { useCallback, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/features/creators/format";
import { PLAN_LABELS, ORG_STATUS_LABELS } from "@/features/platform/plans";
import type { AdminOrgRow } from "@/features/platform/queries";
import { NewOrgDialog } from "@/features/platform/components/new-org-dialog";
import { AdminOrgModal } from "@/features/platform/components/admin-org-modal";
import { loadOrganizations } from "@/features/platform/data-actions";

export function AdminOrgs({
  search,
  firstPage,
}: {
  search: string;
  firstPage: { items: AdminOrgRow[]; hasMore: boolean; page: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [term, setTerm] = useState(search);
  const [items, setItems] = useState(firstPage.items);
  const [page, setPage] = useState(firstPage.page);
  const [hasMore, setHasMore] = useState(firstPage.hasMore);
  const [newOpen, setNewOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedId = params.get("org");
  const setSelected = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(params);
      if (id) next.set("org", id);
      else next.delete("org");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const reload = useCallback(async (q: string) => {
    const res = await loadOrganizations(q, 1);
    setItems(res.items);
    setPage(1);
    setHasMore(res.hasMore);
  }, []);

  function onSearch(v: string) {
    setTerm(v);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => void reload(v), 300);
  }

  async function loadMore() {
    const res = await loadOrganizations(term, page + 1);
    setItems((prev) => [...prev, ...res.items]);
    setPage(res.page);
    setHasMore(res.hasMore);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Buscar por nome ou slug…"
            className="pl-8"
            aria-label="Buscar organizações"
          />
        </div>
        <Button onClick={() => setNewOpen(true)}>
          <Plus className="size-4" /> Nova organização
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-surface p-10 text-center text-sm text-muted-foreground">
          Nenhuma organização.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Usuários</TableHead>
                <TableHead className="text-right">Creators</TableHead>
                <TableHead className="text-right">Programas</TableHead>
                <TableHead className="text-right">Envios</TableHead>
                <TableHead>Criada em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((o) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(o.id)}
                >
                  <TableCell>
                    <span className="flex items-center gap-2 font-medium">
                      <Building2 className="size-3.5 text-muted-foreground" />
                      {o.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      /{o.slug}
                    </span>
                  </TableCell>
                  <TableCell>
                    {o.plan_code ? PLAN_LABELS[o.plan_code] : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={o.status === "active" ? "secondary" : "destructive"}
                    >
                      {ORG_STATUS_LABELS[o.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {o.users_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {o.creators_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {o.programs_count}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {o.shipments_count}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(o.created_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={loadMore}>
            Carregar mais
          </Button>
        </div>
      ) : null}

      <NewOrgDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={() => void reload(term)}
      />
      <AdminOrgModal
        organizationId={selectedId}
        onClose={() => setSelected(null)}
        onChanged={() => void reload(term)}
      />
    </div>
  );
}
