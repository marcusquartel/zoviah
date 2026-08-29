"use client";

import { useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, List, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SHIPMENT_SORTS,
  SHIPMENT_SORT_LABELS,
  serializeShipmentQuery,
  shipmentFiltersActive,
  type ShipmentQuery,
  type ShipmentView,
} from "@/lib/shipment-query";
import {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
} from "@/features/shipments/status";

const ALL = "__all__";

const SORT_ITEMS = SHIPMENT_SORTS.map((s) => ({
  value: s,
  label: SHIPMENT_SORT_LABELS[s],
}));
const STATUS_ITEMS = [
  { value: ALL, label: "Todos os status" },
  ...SHIPMENT_STATUSES.map((s) => ({
    value: s,
    label: SHIPMENT_STATUS_LABELS[s],
  })),
];

export function ShipmentsToolbar({
  query,
  programs,
}: {
  query: ShipmentQuery;
  programs: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [term, setTerm] = useState(query.q);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function apply(patch: Partial<ShipmentQuery>) {
    const qs = serializeShipmentQuery({ ...query, ...patch, page: 1 });
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const programItems = [
    { value: ALL, label: "Todos os programas" },
    ...programs.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-md border p-0.5">
        <Button
          type="button"
          size="sm"
          variant={query.view === "list" ? "secondary" : "ghost"}
          onClick={() => apply({ view: "list" as ShipmentView })}
        >
          <List className="size-4" /> Lista
        </Button>
        <Button
          type="button"
          size="sm"
          variant={query.view === "kanban" ? "secondary" : "ghost"}
          onClick={() => apply({ view: "kanban" as ShipmentView })}
        >
          <LayoutGrid className="size-4" /> Kanban
        </Button>
      </div>

      <div className="relative min-w-[12rem] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            if (debounce.current) clearTimeout(debounce.current);
            debounce.current = setTimeout(
              () => apply({ q: e.target.value }),
              350,
            );
          }}
          placeholder="Buscar creator, e-mail, código de rastreio…"
          className="pl-8"
          aria-label="Buscar envios"
        />
      </div>

      <Select
        items={STATUS_ITEMS}
        value={query.status ?? ALL}
        onValueChange={(v) =>
          apply({ status: v === ALL ? null : (v as ShipmentQuery["status"]) })
        }
      >
        <SelectTrigger className="w-44" aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_ITEMS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={programItems}
        value={query.program ?? ALL}
        onValueChange={(v) => apply({ program: v === ALL ? null : v })}
      >
        <SelectTrigger className="w-48" aria-label="Programa">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {programItems.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Input
        type="date"
        value={query.createdFrom ?? ""}
        aria-label="Criados a partir de"
        className="w-40"
        onChange={(e) => apply({ createdFrom: e.target.value || null })}
      />

      <Select
        items={SORT_ITEMS}
        value={query.sort}
        onValueChange={(v) => v && apply({ sort: v as ShipmentQuery["sort"] })}
      >
        <SelectTrigger className="w-44" aria-label="Ordenar">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_ITEMS.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {shipmentFiltersActive(query) ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            setTerm("");
            router.replace(pathname, { scroll: false });
          }}
        >
          <X className="size-3.5" /> Limpar
        </Button>
      ) : null}
    </div>
  );
}
