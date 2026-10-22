"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Copy, Link2, Pencil, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/features/creators/format";
import { formatCpf } from "@/lib/validation/cpf";
import { loadAddressTab } from "@/features/creators/data-actions";
import {
  createAddressRequest,
  regenerateAddressRequest,
  revokeAddressRequest,
  type AddressLinkResult,
} from "@/features/requests/actions";
import { SecureLinkDialog } from "@/features/requests/components/link-dialog";
import { ManualAddressForm } from "@/features/requests/components/manual-address-form";
import type { AddressTabData } from "@/features/requests/queries";
import type { AddressRequestStatus, CreatorAddress } from "@/types/database";

const REQUEST_STATUS_LABELS: Record<AddressRequestStatus, string> = {
  pending: "Pendente",
  completed: "Concluída",
  expired: "Expirada",
  revoked: "Revogada",
};

/**
 * The address normally arrives with the signup form. The secure link is the
 * fallback for creators who have none (older signups, manual entries, imports)
 * or who need to update it — available at any status, it never moves the
 * application.
 */
export function AddressTab({
  applicationId,
  creatorId,
  onChanged,
}: {
  applicationId: string;
  creatorId: string;
  onChanged: () => void;
}) {
  const [data, setData] = useState<AddressTabData | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<{ url: string; expiresAt: string | null } | null>(
    null,
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const reload = useCallback(async () => {
    setData(await loadAddressTab(applicationId, creatorId));
  }, [applicationId, creatorId]);

  useEffect(() => {
    let active = true;
    void loadAddressTab(applicationId, creatorId).then((d) => {
      if (!active) return;
      setData(d);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [applicationId, creatorId]);

  function handleLink(promise: Promise<AddressLinkResult>, okMsg: string) {
    startTransition(async () => {
      const res = await promise;
      if (res.ok && res.url) {
        setLink({ url: res.url, expiresAt: res.expiresAt ?? null });
        setDialogOpen(true);
        toast.success(okMsg);
        await reload();
        onChanged();
      } else {
        toast.error(res.error ?? "Não foi possível criar o link.");
      }
    });
  }

  function revoke() {
    if (!window.confirm("Revogar a solicitação de endereço? O link atual deixa de funcionar.")) {
      return;
    }
    startTransition(async () => {
      const res = await revokeAddressRequest(applicationId);
      if (res.ok) {
        toast.success("Solicitação revogada.");
        await reload();
        onChanged();
      } else {
        toast.error(res.error ?? "Não foi possível revogar.");
      }
    });
  }

  if (!loaded || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const pendingRequest = data.requests.find((r) => r.status === "pending") ?? null;

  if (editing) {
    return (
      <ManualAddressForm
        creatorId={creatorId}
        current={data.currentAddress}
        onCancel={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          void reload();
          onChanged();
        }}
      />
    );
  }

  return (
    <div className="space-y-5">
      {data.currentAddress ? (
        <CurrentAddress
          address={data.currentAddress}
          onEdit={() => setEditing(true)}
        />
      ) : (
        <Panel>
          <p className="text-sm text-muted-foreground">
            Já tem o endereço e o CPF da creator? Preencha você mesmo.
          </p>
          <Button className="mt-3" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-4" /> Preencher endereço
          </Button>
        </Panel>
      )}

      {pendingRequest ? (
        <Panel>
          <p className="text-sm font-medium">Aguardando a creator preencher</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Solicitação criada</dt>
            <dd>{formatDate(pendingRequest.created_at)}</dd>
            <dt className="text-muted-foreground">Expira</dt>
            <dd>{formatDate(pendingRequest.expires_at)}</dd>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">
            O link não pode ser exibido novamente — gere um novo se necessário.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() =>
                handleLink(
                  regenerateAddressRequest(applicationId),
                  "Novo link gerado.",
                )
              }
            >
              <RefreshCw className="size-4" /> Gerar novo link
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={revoke}
            >
              <X className="size-4" /> Revogar solicitação
            </Button>
          </div>
        </Panel>
      ) : (
        <Panel>
          <p className="text-sm text-muted-foreground">
            {data.currentAddress
              ? "Precisa de um endereço atualizado? Envie um link seguro para a creator preencher de novo."
              : "Esta creator não tem endereço cadastrado. Envie um link seguro para ela preencher endereço e CPF."}
          </p>
          <Button
            className="mt-3"
            variant={data.currentAddress ? "outline" : "default"}
            size={data.currentAddress ? "sm" : "default"}
            disabled={pending}
            onClick={() =>
              handleLink(
                createAddressRequest(applicationId),
                "Link seguro criado.",
              )
            }
          >
            <Link2 className="size-4" />{" "}
            {data.currentAddress ? "Pedir endereço atualizado" : "Solicitar endereço"}
          </Button>
        </Panel>
      )}

      {data.requests.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Histórico de solicitações
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Criada em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead>Concluída</TableHead>
                  <TableHead>Revogada</TableHead>
                  <TableHead>Criada por</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{formatDate(r.created_at)}</TableCell>
                    <TableCell>{REQUEST_STATUS_LABELS[r.status]}</TableCell>
                    <TableCell>{formatDate(r.expires_at)}</TableCell>
                    <TableCell>
                      {r.completed_at ? formatDate(r.completed_at) : "—"}
                    </TableCell>
                    <TableCell>
                      {r.revoked_at ? formatDate(r.revoked_at) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.created_by_email ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ) : null}

      <SecureLinkDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        url={link?.url ?? null}
        expiresAt={link?.expiresAt ?? null}
      />
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border bg-surface p-4">{children}</div>;
}

const ADDRESS_SOURCE_LABELS: Record<CreatorAddress["source"], string> = {
  signup: "Informado na inscrição",
  secure_request: "Informado pelo link seguro",
  manual: "Preenchido pela equipe",
};

function CurrentAddress({
  address,
  onEdit,
}: {
  address: CreatorAddress;
  onEdit: () => void;
}) {
  const lines = [
    address.recipient_name,
    address.cpf ? `CPF ${formatCpf(address.cpf)}` : null,
    `${address.street}, ${address.number}`,
    address.complement || null,
    address.neighborhood,
    `${address.city} / ${address.state}`,
    `CEP ${address.postal_code.replace(/(\d{5})(\d{3})/, "$1-$2")}`,
  ].filter(Boolean) as string[];

  async function copy() {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success("Endereço copiado.");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Endereço de entrega</p>
          <p className="text-xs text-muted-foreground">
            {ADDRESS_SOURCE_LABELS[address.source]}{" "}
            · {formatDate(address.created_at)}
          </p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-4" /> Editar
          </Button>
          <Button variant="ghost" size="sm" onClick={copy}>
            <Copy className="size-4" /> Copiar
          </Button>
        </div>
      </div>
      <address className="mt-2 space-y-0.5 text-sm not-italic">
        {lines.map((l, i) => (
          <p key={i}>{l}</p>
        ))}
      </address>
    </div>
  );
}
