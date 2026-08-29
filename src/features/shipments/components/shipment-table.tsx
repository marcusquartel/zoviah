"use client";

import { ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/features/creators/format";
import { ShipmentStatusBadge } from "@/features/shipments/status-badge";
import type { ShipmentListItem } from "@/types/database";

function itemSummary(it: ShipmentListItem): string {
  if (it.item_count === 0) return "—";
  if (it.item_count === 1) return it.first_item_name ?? "1 item";
  return `${it.first_item_name ?? "Item"} + ${it.item_count - 1}`;
}

export function ShipmentTable({
  items,
  onSelect,
}: {
  items: ShipmentListItem[];
  onSelect: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Creator</TableHead>
            <TableHead>Programa</TableHead>
            <TableHead>Itens</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Transportadora</TableHead>
            <TableHead>Rastreio</TableHead>
            <TableHead>Criado</TableHead>
            <TableHead>Enviado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((it) => (
            <TableRow
              key={it.id}
              className="cursor-pointer"
              onClick={() => onSelect(it.id)}
            >
              <TableCell>
                <p className="font-medium">{it.creator_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {it.creator_email ?? "—"}
                </p>
              </TableCell>
              <TableCell className="text-sm">{it.program_name}</TableCell>
              <TableCell className="text-sm">{itemSummary(it)}</TableCell>
              <TableCell>
                <ShipmentStatusBadge status={it.status} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {it.carrier ?? "—"}
              </TableCell>
              <TableCell className="text-sm">
                {it.tracking_code ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="font-mono text-xs">{it.tracking_code}</span>
                    {it.tracking_url ? (
                      <ExternalLink className="size-3 text-muted-foreground" />
                    ) : null}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatDate(it.created_at)}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {it.shipped_at ? formatDate(it.shipped_at) : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
