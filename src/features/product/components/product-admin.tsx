"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateFeatureRequest,
  upsertRoadmapItem,
  upsertChangelogEntry,
} from "@/features/product/admin-actions";
import {
  FEATURE_STATUS_LABELS,
  ROADMAP_STATUS_LABELS,
  CHANGELOG_STATUS_LABELS,
} from "@/features/product/labels";
import type {
  AdminFeatureRequestRow,
} from "@/features/product/admin-queries";
import type { ChangelogEntry, RoadmapItem } from "@/types/database";

const FR_STATUS_ITEMS = (
  Object.entries(FEATURE_STATUS_LABELS) as [string, string][]
).map(([value, label]) => ({ value, label }));
const RM_STATUS_ITEMS = (
  Object.entries(ROADMAP_STATUS_LABELS) as [string, string][]
).map(([value, label]) => ({ value, label }));
const CL_STATUS_ITEMS = (
  Object.entries(CHANGELOG_STATUS_LABELS) as [string, string][]
).map(([value, label]) => ({ value, label }));

export function ProductAdmin({
  requests,
  roadmap,
  changelog,
}: {
  requests: AdminFeatureRequestRow[];
  roadmap: RoadmapItem[];
  changelog: ChangelogEntry[];
}) {
  const [pending, startTransition] = useTransition();

  function setFrStatus(id: string, status: string) {
    startTransition(async () => {
      const res = await updateFeatureRequest({ requestId: id, status });
      if (res.ok) toast.success("Sugestão atualizada.");
      else toast.error(res.error ?? "Falha.");
    });
  }

  // --- roadmap draft ---
  const [rm, setRm] = useState({
    id: null as string | null,
    title: "",
    summary: "",
    status: "under_consideration",
    sortOrder: 0,
    published: false,
  });
  function saveRoadmap() {
    startTransition(async () => {
      const res = await upsertRoadmapItem({
        id: rm.id,
        title: rm.title,
        summary: rm.summary || null,
        status: rm.status,
        sortOrder: Number(rm.sortOrder) || 0,
        published: rm.published,
      });
      if (res.ok) {
        toast.success("Item de roadmap salvo.");
        setRm({
          id: null,
          title: "",
          summary: "",
          status: "under_consideration",
          sortOrder: 0,
          published: false,
        });
      } else toast.error(res.error ?? "Falha.");
    });
  }

  // --- changelog draft ---
  const [cl, setCl] = useState({
    id: null as string | null,
    title: "",
    summary: "",
    content: "",
    status: "draft",
  });
  function saveChangelog() {
    startTransition(async () => {
      const res = await upsertChangelogEntry({
        id: cl.id,
        title: cl.title,
        summary: cl.summary || null,
        content: cl.content,
        status: cl.status,
      });
      if (res.ok) {
        toast.success("Novidade salva.");
        setCl({ id: null, title: "", summary: "", content: "", status: "draft" });
      } else toast.error(res.error ?? "Falha.");
    });
  }

  return (
    <div className="space-y-10">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Sugestões</h2>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma sugestão.</p>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm"
              >
                <Badge variant="outline">{r.vote_count} votos</Badge>
                <span className="min-w-0 flex-1 font-medium">{r.title}</span>
                <span className="text-xs text-muted-foreground">
                  {r.organization_name}
                </span>
                <div className="w-44">
                  <Select
                    items={FR_STATUS_ITEMS}
                    value={r.status}
                    onValueChange={(v) => v && setFrStatus(r.id, v)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FR_STATUS_ITEMS.map((i) => (
                        <SelectItem key={i.value} value={i.value}>
                          {i.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Roadmap</h2>
          {roadmap.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum item.</p>
          ) : (
            roadmap.map((i) => (
              <button
                key={i.id}
                type="button"
                onClick={() =>
                  setRm({
                    id: i.id,
                    title: i.title,
                    summary: i.summary ?? "",
                    status: i.status,
                    sortOrder: i.sort_order,
                    published: i.published,
                  })
                }
                className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium">{i.title}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {ROADMAP_STATUS_LABELS[i.status]}
                  </span>
                  <Badge variant={i.published ? "secondary" : "outline"}>
                    {i.published ? "Publicado" : "Rascunho"}
                  </Badge>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">
            {rm.id ? "Editar item" : "Novo item"}
          </h3>
          <Input
            placeholder="Título"
            value={rm.title}
            onChange={(e) => setRm({ ...rm, title: e.target.value })}
          />
          <Textarea
            placeholder="Resumo"
            rows={2}
            value={rm.summary}
            onChange={(e) => setRm({ ...rm, summary: e.target.value })}
          />
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              items={RM_STATUS_ITEMS}
              value={rm.status}
              onValueChange={(v) =>
                setRm({ ...rm, status: v ?? "under_consideration" })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RM_STATUS_ITEMS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Input
            type="number"
            placeholder="Ordem"
            value={rm.sortOrder}
            onChange={(e) =>
              setRm({ ...rm, sortOrder: Number(e.target.value) || 0 })
            }
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={rm.published}
              onChange={(e) => setRm({ ...rm, published: e.target.checked })}
            />
            Publicado (visível aos clientes)
          </label>
          <div className="flex gap-2">
            <Button
              onClick={saveRoadmap}
              disabled={pending || rm.title.trim().length < 3}
              className="flex-1"
            >
              Salvar
            </Button>
            {rm.id ? (
              <Button
                variant="ghost"
                onClick={() =>
                  setRm({
                    id: null,
                    title: "",
                    summary: "",
                    status: "under_consideration",
                    sortOrder: 0,
                    published: false,
                  })
                }
              >
                Novo
              </Button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">Novidades</h2>
          {changelog.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma novidade.</p>
          ) : (
            changelog.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() =>
                  setCl({
                    id: e.id,
                    title: e.title,
                    summary: e.summary ?? "",
                    content: e.content,
                    status: e.status,
                  })
                }
                className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <span className="font-medium">{e.title}</span>
                <Badge variant={e.status === "published" ? "secondary" : "outline"}>
                  {CHANGELOG_STATUS_LABELS[e.status]}
                </Badge>
              </button>
            ))
          )}
        </div>
        <div className="space-y-3 rounded-lg border p-4">
          <h3 className="text-sm font-semibold">
            {cl.id ? "Editar novidade" : "Nova novidade"}
          </h3>
          <Input
            placeholder="Título"
            value={cl.title}
            onChange={(e) => setCl({ ...cl, title: e.target.value })}
          />
          <Textarea
            placeholder="Resumo"
            rows={2}
            value={cl.summary}
            onChange={(e) => setCl({ ...cl, summary: e.target.value })}
          />
          <Textarea
            placeholder="Conteúdo"
            rows={6}
            value={cl.content}
            onChange={(e) => setCl({ ...cl, content: e.target.value })}
          />
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select
              items={CL_STATUS_ITEMS}
              value={cl.status}
              onValueChange={(v) => setCl({ ...cl, status: v ?? "draft" })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CL_STATUS_ITEMS.map((i) => (
                  <SelectItem key={i.value} value={i.value}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={saveChangelog}
              disabled={
                pending ||
                cl.title.trim().length < 3 ||
                cl.content.trim().length < 10
              }
              className="flex-1"
            >
              Salvar
            </Button>
            {cl.id ? (
              <Button
                variant="ghost"
                onClick={() =>
                  setCl({
                    id: null,
                    title: "",
                    summary: "",
                    content: "",
                    status: "draft",
                  })
                }
              >
                Novo
              </Button>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
