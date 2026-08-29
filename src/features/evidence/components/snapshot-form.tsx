"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseViews } from "@/features/evidence/parse-views";
import { mean, median } from "@/features/evidence/metrics";
import { SOURCE_OPTIONS, fmtInt } from "@/features/evidence/format";
import {
  createMetricSnapshot,
  updateMetricSnapshot,
  type SnapshotFormInput,
} from "@/features/evidence/actions";
import type { MetricSource, SocialMetricSnapshot } from "@/types/database";

const todayIso = () => new Date().toISOString().slice(0, 10);

function fromSnapshot(s: SocialMetricSnapshot): State {
  return {
    source: s.source,
    observedAt: s.observed_at.slice(0, 10),
    followers: s.followers?.toString() ?? "",
    viewsText: Array.isArray(s.views_sample) ? s.views_sample.join("\n") : "",
    postsCount: s.posts_count?.toString() ?? "",
    periodDays: s.period_days?.toString() ?? "30",
    reach: s.reach?.toString() ?? "",
    averageLikes: s.average_likes?.toString() ?? "",
    averageComments: s.average_comments?.toString() ?? "",
    notes: s.notes ?? "",
  };
}

interface State {
  source: MetricSource;
  observedAt: string;
  followers: string;
  viewsText: string;
  postsCount: string;
  periodDays: string;
  reach: string;
  averageLikes: string;
  averageComments: string;
  notes: string;
}

const EMPTY: State = {
  source: "admin_manual",
  observedAt: todayIso(),
  followers: "",
  viewsText: "",
  postsCount: "",
  periodDays: "30",
  reach: "",
  averageLikes: "",
  averageComments: "",
  notes: "",
};

export function SnapshotFormDialog({
  open,
  onOpenChange,
  socialProfileId,
  platformLabel,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  socialProfileId: string;
  platformLabel: string;
  editing: SocialMetricSnapshot | null;
  onSaved: () => void;
}) {
  const [state, setState] = useState<State>(EMPTY);
  const [advanced, setAdvanced] = useState(false);
  const [pending, startTransition] = useTransition();

  // Re-seed the form whenever the dialog is (re)opened.
  const seedKey = `${open}:${editing?.id ?? "new"}`;
  const [lastSeed, setLastSeed] = useState("");
  if (open && seedKey !== lastSeed) {
    setLastSeed(seedKey);
    setState(editing ? fromSnapshot(editing) : { ...EMPTY, observedAt: todayIso() });
    setAdvanced(Boolean(editing?.reach || editing?.average_likes));
  }

  const set = <K extends keyof State>(key: K, value: State[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  // Preview only — the server re-parses and recomputes authoritatively (§11).
  const preview = useMemo(() => {
    const { values, invalid } = parseViews(state.viewsText);
    return {
      count: values.length,
      median: median(values),
      mean: mean(values),
      invalid,
    };
  }, [state.viewsText]);

  function submit() {
    const payload: SnapshotFormInput = {
      socialProfileId,
      source: state.source,
      observedAt: state.observedAt,
      followers: state.followers,
      viewsText: state.viewsText,
      postsCount: state.postsCount,
      periodDays: state.periodDays,
      reach: advanced ? state.reach : "",
      averageLikes: advanced ? state.averageLikes : "",
      averageComments: advanced ? state.averageComments : "",
      notes: state.notes,
    };
    startTransition(async () => {
      const res = editing
        ? await updateMetricSnapshot(editing.id, payload)
        : await createMetricSnapshot(payload);
      if (res.ok) {
        toast.success(editing ? "Métricas atualizadas." : "Métricas registradas.");
        onOpenChange(false);
        onSaved();
      } else {
        toast.error(res.fieldError ?? res.error ?? "Não foi possível salvar as métricas.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar métricas" : "Adicionar métricas"} · {platformLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="snap-observed">Data da observação</Label>
              <Input
                id="snap-observed"
                type="date"
                max={todayIso()}
                value={state.observedAt}
                onChange={(e) => set("observedAt", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Origem</Label>
              <Select
                value={state.source}
                onValueChange={(v) => set("source", v as MetricSource)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="snap-followers">Seguidores (observados)</Label>
            <Input
              id="snap-followers"
              inputMode="numeric"
              placeholder="ex.: 24500"
              value={state.followers}
              onChange={(e) => set("followers", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Não substitui o valor informado no cadastro — fica registrado como
              observação.
            </p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="snap-views">Views dos conteúdos recentes</Label>
            <Textarea
              id="snap-views"
              rows={4}
              placeholder={"Um número por linha\n7.100\n9.480\n5.230"}
              value={state.viewsText}
              onChange={(e) => set("viewsText", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {preview.count > 0
                ? `Amostra: ${preview.count} ${
                    preview.count === 1 ? "conteúdo" : "conteúdos"
                  } · Mediana: ${fmtInt(preview.median)} · Média: ${fmtInt(
                    preview.mean,
                  )}`
                : "Cole as views (máx. 30). A mediana é calculada no servidor."}
              {preview.invalid.length > 0 ? (
                <span className="text-warning-foreground">
                  {" "}
                  · ignorados: {preview.invalid.slice(0, 5).join(", ")}
                </span>
              ) : null}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="snap-posts">Posts no período</Label>
              <Input
                id="snap-posts"
                inputMode="numeric"
                placeholder="ex.: 12"
                value={state.postsCount}
                onChange={(e) => set("postsCount", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="snap-period">Período (dias)</Label>
              <Input
                id="snap-period"
                inputMode="numeric"
                placeholder="30"
                value={state.periodDays}
                onChange={(e) => set("periodDays", e.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            className="text-xs font-medium text-primary hover:underline"
            onClick={() => setAdvanced((v) => !v)}
          >
            {advanced ? "Ocultar campos avançados" : "Campos avançados (alcance, likes, comentários)"}
          </button>

          {advanced ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="snap-reach">Alcance</Label>
                <Input
                  id="snap-reach"
                  inputMode="numeric"
                  value={state.reach}
                  onChange={(e) => set("reach", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="snap-likes">Likes médios</Label>
                <Input
                  id="snap-likes"
                  inputMode="numeric"
                  value={state.averageLikes}
                  onChange={(e) => set("averageLikes", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="snap-comments">Coment. médios</Label>
                <Input
                  id="snap-comments"
                  inputMode="numeric"
                  value={state.averageComments}
                  onChange={(e) => set("averageComments", e.target.value)}
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-1">
            <Label htmlFor="snap-notes">Observações (opcional)</Label>
            <Textarea
              id="snap-notes"
              rows={2}
              maxLength={500}
              value={state.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Salvando…" : editing ? "Salvar alterações" : "Salvar métricas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
