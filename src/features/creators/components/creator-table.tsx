"use client";

import { Camera, Music2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ApplicationStatusBadge } from "@/features/applications/status-badge";
import { StatusMenu } from "@/features/creators/components/status-menu";
import { formatDate, formatFollowers, initialsOf } from "@/features/creators/format";
import type { ApplicationListItem, ApplicationStatus } from "@/types/database";

interface CreatorTableProps {
  items: ApplicationListItem[];
  onSelect: (applicationId: string) => void;
  onStatusChanged: (applicationId: string, to: ApplicationStatus) => void;
}

export function CreatorTable({
  items,
  onSelect,
  onStatusChanged,
}: CreatorTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Creator</TableHead>
            <TableHead>Redes</TableHead>
            <TableHead>Programa</TableHead>
            <TableHead className="text-right">Seguidores</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Cadastro</TableHead>
            <TableHead className="text-right">Ações</TableHead>
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
                <div className="flex items-center gap-2.5">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-[0.7rem]">
                      {initialsOf(it.creator_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{it.creator_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {it.creator_email ?? "—"}
                    </p>
                  </div>
                  {it.possible_duplicate ? (
                    <Badge variant="secondary" className="shrink-0 gap-1">
                      Poss. dup.
                    </Badge>
                  ) : null}
                </div>
              </TableCell>

              <TableCell>
                <div className="space-y-0.5 text-xs">
                  {it.instagram_handle ? (
                    <span className="flex items-center gap-1">
                      <Camera className="size-3 text-muted-foreground" />
                      @{it.instagram_handle_normalized ?? it.instagram_handle}
                    </span>
                  ) : null}
                  {it.tiktok_handle ? (
                    <span className="flex items-center gap-1">
                      <Music2 className="size-3 text-muted-foreground" />
                      @{it.tiktok_handle_normalized ?? it.tiktok_handle}
                    </span>
                  ) : null}
                  {!it.instagram_handle && !it.tiktok_handle ? (
                    <span className="text-muted-foreground">—</span>
                  ) : null}
                </div>
              </TableCell>

              <TableCell className="text-sm">{it.program_name}</TableCell>

              <TableCell className="text-right text-xs tabular-nums">
                {it.instagram_followers != null ? (
                  <div>IG {formatFollowers(it.instagram_followers)}</div>
                ) : null}
                {it.tiktok_followers != null ? (
                  <div>TT {formatFollowers(it.tiktok_followers)}</div>
                ) : null}
                {it.instagram_followers == null && it.tiktok_followers == null
                  ? "—"
                  : null}
              </TableCell>

              <TableCell>
                <ApplicationStatusBadge status={it.status} />
              </TableCell>

              <TableCell className="text-xs text-muted-foreground">
                {formatDate(it.submitted_at)}
              </TableCell>

              <TableCell
                className="text-right"
                onClick={(e) => e.stopPropagation()}
              >
                <StatusMenu
                  applicationId={it.id}
                  status={it.status}
                  size="xs"
                  label="Status"
                  onChanged={(to) => onStatusChanged(it.id, to)}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
