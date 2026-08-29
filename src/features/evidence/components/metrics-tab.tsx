"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatFollowers } from "@/features/creators/format";
import {
  loadMetricsForApplication,
  loadSnapshotHistoryPage,
} from "@/features/creators/data-actions";
import type { ApplicationMetrics, ProfileMetrics } from "@/features/evidence/queries";
import {
  SOURCE_LABELS,
  STALE_AFTER_DAYS,
  fmtDecimal,
  fmtInt,
  fmtPct,
  fmtPctSigned,
  relativeDays,
} from "@/features/evidence/format";
import { SnapshotFormDialog } from "@/features/evidence/components/snapshot-form";
import type { SocialMetricSnapshot } from "@/types/database";

const PLATFORM_LABELS: Record<string, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  twitch: "Twitch",
  kwai: "Kwai",
  x: "X",
  facebook: "Facebook",
  other: "Outro",
};

const DIVERGENCE_THRESHOLD = 0.2;

export function MetricsTab({
  applicationId,
  onEvidenceChanged,
}: {
  applicationId: string;
  /** Refresh the drawer so the ScoreBar "Novas evidências" badge updates. */
  onEvidenceChanged: () => void;
}) {
  const [data, setData] = useState<ApplicationMetrics | null>(null);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    setData(await loadMetricsForApplication(applicationId));
  }, [applicationId]);

  useEffect(() => {
    let active = true;
    void loadMetricsForApplication(applicationId).then((d) => {
      if (!active) return;
      setData(d);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [applicationId]);

  if (!loaded) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!data || data.profiles.length === 0) {
    return (
      <p className="rounded-lg border border-dashed bg-surface p-6 text-center text-sm text-muted-foreground">
        Nenhuma rede cadastrada. Adicione um perfil na aba <strong>Redes</strong>{" "}
        para registrar métricas.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        Métricas observadas são <strong>evidência factual</strong>. Não alteram o
        Creator Score nesta fase — servem para calibrar versões futuras.
      </p>
      {data.profiles.map((pm) => (
        <ProfileCard
          // Remount (reset paging state) whenever a save changes this profile.
          key={`${pm.profile.id}:${pm.latest?.id ?? "none"}:${pm.historyTotal}`}
          pm={pm}
          onSaved={async () => {
            await reload();
            onEvidenceChanged();
          }}
        />
      ))}
    </div>
  );
}

function ProfileCard({
  pm,
  onSaved,
}: {
  pm: ProfileMetrics;
  onSaved: () => void;
}) {
  const { profile, latest, derived } = pm;
  const label = PLATFORM_LABELS[profile.platform] ?? profile.platform;
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SocialMetricSnapshot | null>(null);

  const [rows, setRows] = useState<SocialMetricSnapshot[]>(pm.history);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(pm.historyTotal > pm.history.length);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = await loadSnapshotHistoryPage(profile.id, page + 1);
      setRows((r) => [...r, ...next.items]);
      setPage((p) => p + 1);
      setHasMore(next.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }

  const declared = profile.followers_declared;
  const diverges =
    latest?.followers != null &&
    declared != null &&
    declared > 0 &&
    Math.abs(latest.followers - declared) / declared > DIVERGENCE_THRESHOLD;

  const stale = derived != null && derived.snapshotAgeDays > STALE_AFTER_DAYS;

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{label}</p>
          <p className="truncate text-xs text-muted-foreground">
            @{profile.handle_normalized} · cadastro:{" "}
            {formatFollowers(declared)} seguidores
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {latest ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(latest);
                setFormOpen(true);
              }}
            >
              <Pencil className="size-4" /> Editar
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" /> Adicionar métricas
          </Button>
        </div>
      </div>

      {latest && derived ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <Stat label="Seguidores (obs.)" value={fmtInt(derived.followers)} />
            <Stat label="Mediana de views" value={fmtInt(derived.medianViews)} />
            <Stat label="Média de views" value={fmtInt(derived.averageViews)} />
            <Stat label="View rate" value={fmtPct(derived.medianViewRate)} />
            <Stat label="Posts / semana" value={fmtDecimal(derived.postsPerWeek)} />
            <Stat
              label="Engaj. / seguidores"
              value={fmtPct(derived.engagementByFollowers)}
            />
            <Stat
              label="Engaj. / alcance"
              value={fmtPct(derived.engagementByReach)}
            />
            <Stat label="Alcance" value={fmtInt(derived.reach)} />
            <Stat
              label="Crescimento"
              value={
                derived.followerGrowthAbsolute == null
                  ? "—"
                  : `${derived.followerGrowthAbsolute > 0 ? "+" : ""}${fmtInt(
                      derived.followerGrowthAbsolute,
                    )} (${fmtPctSigned(derived.followerGrowthRate)})`
              }
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              Amostra: {derived.sampleSize}{" "}
              {derived.sampleSize === 1 ? "conteúdo" : "conteúdos"}
            </span>
            <span>·</span>
            <span>Observado {relativeDays(derived.snapshotAgeDays)}</span>
            <span>·</span>
            <span>{SOURCE_LABELS[latest.source]}</span>
            {stale ? (
              <Badge variant="outline" className="text-warning-foreground">
                Dados antigos
              </Badge>
            ) : null}
          </div>

          {diverges ? (
            <p className="mt-2 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
              Valor observado difere do valor informado no cadastro.
            </p>
          ) : null}
        </>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhuma métrica registrada ainda.
        </p>
      )}

      {rows.length > 0 ? (
        <div className="mt-4 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Seguidores</TableHead>
                <TableHead className="text-right">Mediana views</TableHead>
                <TableHead className="text-right">View rate</TableHead>
                <TableHead className="text-right">Posts/sem</TableHead>
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const vr =
                  r.median_views != null &&
                  r.followers != null &&
                  r.followers > 0
                    ? r.median_views / r.followers
                    : null;
                const ppw =
                  r.posts_count != null &&
                  r.period_days != null &&
                  r.period_days > 0
                    ? (r.posts_count / r.period_days) * 7
                    : null;
                return (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.observed_at)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtInt(r.followers)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtInt(r.median_views)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtPct(vr)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtDecimal(ppw)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {SOURCE_LABELS[r.source]}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {hasMore ? (
            <div className="mt-2 flex justify-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Carregando…" : "Carregar mais"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <SnapshotFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        socialProfileId={profile.id}
        platformLabel={label}
        editing={editing}
        onSaved={onSaved}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="tabular-nums">{value}</p>
    </div>
  );
}
