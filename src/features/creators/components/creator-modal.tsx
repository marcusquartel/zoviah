"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initialsOf } from "@/features/creators/format";
import { SummaryTab } from "@/features/creators/components/drawer/summary";
import { RegistrationTab } from "@/features/creators/components/drawer/registration";
import { SocialsTab } from "@/features/creators/components/drawer/socials";
import { AnswersTab } from "@/features/creators/components/drawer/answers";
import { Timeline } from "@/features/creators/components/timeline";
import { NoteForm } from "@/features/creators/components/note-form";
import { IntelligenceTab } from "@/features/analysis/components/intelligence-tab";
import { ScoreBar } from "@/features/analysis/components/score-bar";
import {
  loadDrawerData,
  type DrawerData,
} from "@/features/creators/data-actions";

const TABS = [
  { id: "summary", label: "Resumo" },
  { id: "intelligence", label: "Inteligência" },
  { id: "registration", label: "Cadastro" },
  { id: "socials", label: "Redes" },
  { id: "answers", label: "Respostas" },
  { id: "history", label: "Histórico" },
] as const;
type TabId = (typeof TABS)[number]["id"];

interface CreatorModalProps {
  applicationId: string | null;
  onClose: () => void;
  onStatusChanged: () => void;
}

export function CreatorModal({
  applicationId,
  onClose,
  onStatusChanged,
}: CreatorModalProps) {
  const [data, setData] = useState<DrawerData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setData(await loadDrawerData(id));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!applicationId) return;
    // Fetch-on-open: syncing the modal with server state for this application.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(applicationId);
  }, [applicationId, load]);

  const refresh = useCallback(() => {
    if (applicationId) void load(applicationId);
    onStatusChanged();
  }, [applicationId, load, onStatusChanged]);

  return (
    <Dialog
      open={applicationId != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[86vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {/* keyed by applicationId so tab state resets per creator */}
        <ModalBody
          key={applicationId ?? "none"}
          data={data}
          loading={loading}
          onRefresh={refresh}
        />
      </DialogContent>
    </Dialog>
  );
}

function ModalBody({
  data,
  loading,
  onRefresh,
}: {
  data: DrawerData | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<TabId>("summary");
  const detail = data?.detail ?? null;
  const analysis = data?.analysis ?? {
    aiConfigured: false,
    current: null,
    history: [],
  };

  return (
    <>
      <DialogHeader className="shrink-0 border-b p-4">
        {detail ? (
          <div className="flex items-center gap-3 pr-8">
            <Avatar className="size-9">
              <AvatarFallback>
                {initialsOf(detail.creator.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <DialogTitle className="truncate">
                {detail.creator.preferred_name || detail.creator.full_name}
              </DialogTitle>
              <p className="truncate text-xs text-muted-foreground">
                {detail.creator.email ?? "sem e-mail"}
              </p>
            </div>
          </div>
        ) : (
          <DialogTitle>{loading ? "Carregando…" : "Inscrição"}</DialogTitle>
        )}
      </DialogHeader>

      {detail ? (
        <>
          <ScoreBar
            applicationId={detail.application.id}
            analysisStatus={detail.application.analysis_status}
            current={analysis.current}
            aiConfigured={analysis.aiConfigured}
            onRefresh={onRefresh}
          />

          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b px-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={tab === t.id ? "page" : undefined}
                className={cn(
                  "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  tab === t.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {loading && !detail ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !detail ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Inscrição não encontrada.
          </p>
        ) : tab === "summary" ? (
          <SummaryTab detail={detail} onChanged={onRefresh} />
        ) : tab === "intelligence" ? (
          <IntelligenceTab
            applicationId={detail.application.id}
            analysisStatus={detail.application.analysis_status}
            analysis={analysis}
            onRefresh={onRefresh}
          />
        ) : tab === "registration" ? (
          <RegistrationTab creator={detail.creator} />
        ) : tab === "socials" ? (
          <SocialsTab socials={detail.socials} />
        ) : tab === "answers" ? (
          <AnswersTab application={detail.application} />
        ) : (
          <div className="space-y-4">
            <NoteForm
              creatorId={detail.creator.id}
              applicationId={detail.application.id}
              onAdded={onRefresh}
            />
            <Timeline events={data?.timeline ?? []} />
          </div>
        )}
      </div>
    </>
  );
}
