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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  setOrganizationBranding,
  setOrganizationPlan,
  setOrganizationStatus,
  setOrganizationSubdomain,
  uploadOrganizationLogo,
} from "@/features/platform/actions";
import type { AdminOrgDetail } from "@/features/platform/queries";
import { PRODUCT } from "@/config/product";
import { BrandLogo } from "@/components/brand-logo";

const subdomainify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);

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
  const [logoUrl, setLogoUrl] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const [subdomain, setSubdomain] = useState("");

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const detail = await loadOrganizationDetail(id);
      setData(detail);
      setLogoUrl(detail?.logo_url ?? "");
      setFaviconUrl(detail?.favicon_url ?? "");
      setSubdomain(detail?.subdomain ?? "");
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

  function saveSubdomain() {
    if (!data) return;
    startTransition(async () => {
      const res = await setOrganizationSubdomain(data.id, subdomain.trim());
      if (res.ok) {
        toast.success(
          subdomain.trim() ? "Subdomínio atualizado." : "Subdomínio removido.",
        );
        await load(data.id);
        onChanged();
      } else {
        toast.error(res.error ?? "Não foi possível salvar o subdomínio.");
      }
    });
  }

  function saveBranding() {
    if (!data) return;
    startTransition(async () => {
      const res = await setOrganizationBranding(data.id, { logoUrl, faviconUrl });
      if (res.ok) {
        toast.success("Branding atualizado.");
        await load(data.id);
        onChanged();
      } else {
        toast.error(res.error ?? "Não foi possível salvar o branding.");
      }
    });
  }

  function uploadLogo(file: File) {
    if (!data) return;
    const fd = new FormData();
    fd.set("file", file);
    const orgId = data.id;
    startTransition(async () => {
      const up = await uploadOrganizationLogo(orgId, fd);
      if (!up.ok || !up.url) {
        toast.error(up.error ?? "Não foi possível enviar a imagem.");
        return;
      }
      const saved = await setOrganizationBranding(orgId, {
        logoUrl: up.url,
        faviconUrl,
      });
      if (saved.ok) {
        setLogoUrl(up.url);
        toast.success("Logo enviada.");
        await load(orgId);
        onChanged();
      } else {
        toast.error(saved.error ?? "Imagem enviada, mas não foi salva.");
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
              <dd>/p/{data.slug}</dd>
              <dt className="text-muted-foreground">Subdomínio</dt>
              <dd className="font-mono text-xs">
                {data.subdomain
                  ? `${data.subdomain}.${PRODUCT.domain}`
                  : "— (nenhum)"}
              </dd>
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

            <div className="mt-2 space-y-2 border-t pt-3">
              <p className="text-sm font-medium">Subdomínio</p>
              <Input
                value={subdomain}
                onChange={(e) => setSubdomain(subdomainify(e.target.value))}
                placeholder="minhaempresa"
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">
                Endereço do tenant:{" "}
                <span className="font-mono">
                  {subdomain || "subdominio"}.{PRODUCT.domain}
                </span>
                . Independente do slug ({`/p/${data.slug}`} continua igual).
                Vazio = sem endereço.
              </p>
              <Button
                size="sm"
                variant="outline"
                disabled={pending || subdomain === (data.subdomain ?? "")}
                onClick={saveSubdomain}
              >
                Salvar subdomínio
              </Button>
            </div>

            <div className="mt-2 space-y-3 border-t pt-3">
              <p className="text-sm font-medium">Branding</p>
              <p className="text-xs text-muted-foreground">
                A marca aparece sobre fundo claro (login, topo do sistema e
                formulários) — evite logos brancas. PNG ou JPG, até 1 MB. A
                imagem é recortada automaticamente; envie o arquivo sem muita
                margem em volta da marca.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="org-logo-file" className="text-xs">
                  Enviar imagem da marca
                </Label>
                <input
                  id="org-logo-file"
                  type="file"
                  accept="image/png,image/jpeg"
                  disabled={pending}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadLogo(f);
                    e.target.value = "";
                  }}
                  className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-2.5 file:py-1 file:text-xs file:font-medium hover:file:bg-accent"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-logo-url" className="text-xs">
                  …ou cole uma URL de logo
                </Label>
                <Input
                  id="org-logo-url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://…/logo.svg"
                  disabled={pending}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-favicon-url" className="text-xs">
                  Favicon URL
                </Label>
                <Input
                  id="org-favicon-url"
                  value={faviconUrl}
                  onChange={(e) => setFaviconUrl(e.target.value)}
                  placeholder="https://…/favicon.png"
                  disabled={pending}
                />
              </div>
              {logoUrl || faviconUrl ? (
                <div className="flex items-center gap-4 rounded-md border bg-white p-3">
                  {logoUrl ? (
                    <BrandLogo src={logoUrl} alt="Prévia do logo" size="sm" />
                  ) : null}
                  {faviconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={faviconUrl}
                      alt="Prévia do favicon"
                      className="size-6 object-contain"
                    />
                  ) : null}
                </div>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                disabled={
                  pending ||
                  (logoUrl === (data.logo_url ?? "") &&
                    faviconUrl === (data.favicon_url ?? ""))
                }
                onClick={saveBranding}
              >
                Salvar branding
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
