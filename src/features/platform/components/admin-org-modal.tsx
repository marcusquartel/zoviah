"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/features/creators/format";
import { PLAN_CODES, PLAN_LABELS, ORG_STATUS_LABELS } from "@/features/platform/plans";
import { loadOrganizationDetail } from "@/features/platform/data-actions";
import {
  setOrganizationPlan,
  setOrganizationStatus,
} from "@/features/platform/actions";
import type { AdminOrgDetail } from "@/features/platform/queries";

const PLAN_ITEMS = PLAN_CODES.map((p) => ({ value: p, label: PLAN_LABELS[p] }));

export function AdminOrgModal({
  organizationId,
  onClose,
  onChanged,
}: {
  organizationId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<AdminOrgDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setData(await loadOrganizationDetail(id));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!organizationId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(organizationId);
  }, [organizationId, load]);

  function toggleStatus() {
    if (!data) return;
    const to = data.status === "active" ? "suspended" : "active";
    if (
      to === "suspended" &&
      !window.confirm(
        `Suspender "${data.name}"? Os usuários deixam de operar o painel (dados preservados).`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await setOrganizationStatus(data.id, to);
      if (res.ok) {
        toast.success(to === "suspended" ? "Organização suspensa." : "Organização reativada.");
        await load(data.id);
        onChanged();
      } else {
        toast.error(res.error ?? "Não foi possível alterar o status.");
      }
    });
  }

  function changePlan(plan: string | null) {
    if (!data || !plan || plan === data.plan_code) return;
    startTransition(async () => {
      const res = await setOrganizationPlan(data.id, plan);
      if (res.ok) {
        toast.success("Plano atualizado.");
        await load(data.id);
        onChanged();
      } else {
        toast.error(res.error ?? "Não foi possível alterar o plano.");
      }
    });
  }

  return (
    <Dialog
      open={organizationId != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {loading && !data ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : !data ? (
          <>
            <DialogHeader>
              <DialogTitle>Organização</DialogTitle>
            </DialogHeader>
            <p className="py-6 text-center text-sm text-muted-foreground">
              Organização não encontrada.
            </p>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {data.name}
                <Badge
                  variant={data.status === "active" ? "secondary" : "destructive"}
                >
                  {ORG_STATUS_LABELS[data.status]}
                </Badge>
              </DialogTitle>
            </DialogHeader>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Slug</dt>
              <dd>/{data.slug}</dd>
              <dt className="text-muted-foreground">Criada em</dt>
              <dd>{formatDate(data.created_at)}</dd>
              <dt className="text-muted-foreground">Usuários</dt>
              <dd className="tabular-nums">{data.users_count}</dd>
              <dt className="text-muted-foreground">Creators</dt>
              <dd className="tabular-nums">{data.creators_count}</dd>
              <dt className="text-muted-foreground">Programas</dt>
              <dd className="tabular-nums">{data.programs_count}</dd>
              <dt className="text-muted-foreground">Inscrições</dt>
              <dd className="tabular-nums">{data.applications_count}</dd>
              <dt className="text-muted-foreground">Análises IA</dt>
              <dd className="tabular-nums">{data.analyses_count}</dd>
              <dt className="text-muted-foreground">Envios</dt>
              <dd className="tabular-nums">{data.shipments_count}</dd>
              <dt className="text-muted-foreground">Convites pendentes</dt>
              <dd className="tabular-nums">{data.pending_invites}</dd>
            </dl>

            <div className="mt-2 space-y-3 border-t pt-3">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">Plano comercial</span>
                <Select
                  items={PLAN_ITEMS}
                  value={data.plan_code ?? "founding"}
                  onValueChange={changePlan}
                >
                  <SelectTrigger className="w-40" disabled={pending}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLAN_ITEMS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">Acesso</span>
                <Button
                  size="sm"
                  variant={data.status === "active" ? "outline" : "default"}
                  disabled={pending}
                  onClick={toggleStatus}
                >
                  {data.status === "active" ? "Suspender" : "Reativar"}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
