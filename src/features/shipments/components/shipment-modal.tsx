"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCpf } from "@/lib/validation/cpf";
import { formatDate, formatDateTime } from "@/features/creators/format";
import { ShipmentStatusBadge } from "@/features/shipments/status-badge";
import {
  SHIPMENT_STATUS_LABELS,
  isShipmentAddressStale,
  nextShipmentStatuses,
  shipmentActionLabel,
} from "@/features/shipments/status";
import {
  ItemsEditor,
  type ItemRow,
} from "@/features/shipments/components/items-editor";
import {
  loadShipmentDetail,
} from "@/features/shipments/data-actions";
import {
  refreshShipmentAddress,
  transitionShipmentStatus,
  updateShipmentItems,
  updateShipmentTracking,
} from "@/features/shipments/actions";
import type { ShipmentDetail } from "@/features/shipments/queries";

const TABS = ["summary", "items", "tracking", "address"] as const;
const TAB_LABELS: Record<(typeof TABS)[number], string> = {
  summary: "Resumo",
  items: "Itens",
  tracking: "Rastreio",
  address: "Endereço",
};

export function ShipmentModal({
  shipmentId,
  onClose,
  onChanged,
}: {
  shipmentId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<ShipmentDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setData(await loadShipmentDetail(id));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!shipmentId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(shipmentId);
  }, [shipmentId, load]);

  const refresh = useCallback(() => {
    if (shipmentId) void load(shipmentId);
    onChanged();
  }, [shipmentId, load, onChanged]);

  return (
    <Dialog
      open={shipmentId != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="flex max-h-[86vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
        {loading && !data ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !data ? (
          <div className="p-6">
            <DialogHeader>
              <DialogTitle>Envio</DialogTitle>
            </DialogHeader>
            <p className="py-8 text-center text-sm text-muted-foreground">
              Envio não encontrado.
            </p>
          </div>
        ) : (
          <Body key={shipmentId} data={data} onRefresh={refresh} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Body({
  data,
  onRefresh,
}: {
  data: ShipmentDetail;
  onRefresh: () => void;
}) {
  const { shipment, creator, program } = data;
  const [tab, setTab] = useState<(typeof TABS)[number]>("summary");
  const [pending, startTransition] = useTransition();
  const options = nextShipmentStatuses(shipment.status);

  function transition(to: (typeof options)[number]) {
    startTransition(async () => {
      const res = await transitionShipmentStatus({
        shipmentId: shipment.id,
        toStatus: to,
      });
      if (res.ok) {
        toast.success("Status atualizado.");
        onRefresh();
      } else {
        toast.error(res.error ?? "Não foi possível mudar o status.");
      }
    });
  }

  return (
    <>
      <DialogHeader className="shrink-0 border-b p-4">
        <div className="flex items-center justify-between gap-2 pr-8">
          <div className="min-w-0">
            <DialogTitle className="truncate">{creator.full_name}</DialogTitle>
            <p className="truncate text-xs text-muted-foreground">
              {program.name}
            </p>
          </div>
          <ShipmentStatusBadge status={shipment.status} />
        </div>
      </DialogHeader>

      {options.length > 0 ? (
        <div className="flex flex-wrap gap-2 border-b bg-surface px-4 py-2.5">
          {options.map((to) => (
            <Button
              key={to}
              size="sm"
              variant={to === "cancelled" ? "ghost" : "default"}
              disabled={pending}
              onClick={() => {
                if (
                  to === "cancelled" &&
                  !window.confirm("Cancelar este envio?")
                ) {
                  return;
                }
                transition(to);
              }}
            >
              {shipmentActionLabel(shipment.status, to)}
            </Button>
          ))}
        </div>
      ) : null}

      <nav className="flex shrink-0 gap-1 overflow-x-auto border-b px-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-current={tab === t ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "summary" ? (
          <SummaryTab data={data} />
        ) : tab === "items" ? (
          <ItemsTab data={data} onSaved={onRefresh} />
        ) : tab === "tracking" ? (
          <TrackingTab data={data} onSaved={onRefresh} />
        ) : (
          <AddressTab data={data} onRefreshed={onRefresh} />
        )}
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function SummaryTab({ data }: { data: ShipmentDetail }) {
  const { shipment, items } = data;
  const qty = items.reduce((s, i) => s + i.quantity, 0);
  return (
    <dl className="divide-y">
      <Row label="Status" value={SHIPMENT_STATUS_LABELS[shipment.status]} />
      <Row label="Criado em" value={formatDateTime(shipment.created_at)} />
      <Row
        label="Enviado em"
        value={shipment.shipped_at ? formatDateTime(shipment.shipped_at) : "—"}
      />
      <Row
        label="Entregue em"
        value={
          shipment.delivered_at ? formatDateTime(shipment.delivered_at) : "—"
        }
      />
      {shipment.cancelled_at ? (
        <Row
          label="Cancelado em"
          value={formatDateTime(shipment.cancelled_at)}
        />
      ) : null}
      <Row label="Transportadora" value={shipment.carrier ?? "—"} />
      <Row
        label="Rastreio"
        value={
          shipment.tracking_code ? (
            <span className="font-mono text-xs">{shipment.tracking_code}</span>
          ) : (
            "—"
          )
        }
      />
      <Row
        label="Itens"
        value={`${items.length} ${items.length === 1 ? "item" : "itens"} · ${qty} un.`}
      />
      {shipment.internal_notes ? (
        <div className="py-1.5 text-sm">
          <dt className="text-muted-foreground">Nota interna</dt>
          <dd className="mt-1 whitespace-pre-line">{shipment.internal_notes}</dd>
        </div>
      ) : null}
    </dl>
  );
}

const EDITABLE_ITEMS = new Set(["draft", "preparing"]);

function ItemsTab({
  data,
  onSaved,
}: {
  data: ShipmentDetail;
  onSaved: () => void;
}) {
  const editable = EDITABLE_ITEMS.has(data.shipment.status);
  const [rows, setRows] = useState<ItemRow[]>(
    data.items.map((i) => ({
      itemName: i.item_name,
      sku: i.sku ?? "",
      quantity: String(i.quantity),
    })),
  );
  const [pending, startTransition] = useTransition();

  if (!editable) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Os itens não podem mais ser alterados neste envio.
        </p>
        <ul className="divide-y rounded-lg border text-sm">
          {data.items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 px-3 py-2">
              <span>
                {i.item_name}
                {i.sku ? (
                  <span className="text-muted-foreground"> · {i.sku}</span>
                ) : null}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {i.quantity} un.
              </span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  function save() {
    startTransition(async () => {
      const res = await updateShipmentItems({
        shipmentId: data.shipment.id,
        items: rows.map((r) => ({
          itemName: r.itemName,
          sku: r.sku,
          quantity: r.quantity,
        })),
      });
      if (res.ok) {
        toast.success("Itens atualizados.");
        onSaved();
      } else {
        toast.error(res.error ?? "Não foi possível salvar os itens.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <ItemsEditor rows={rows} onChange={setRows} disabled={pending} />
      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? "Salvando…" : "Salvar itens"}
        </Button>
      </div>
    </div>
  );
}

function TrackingTab({
  data,
  onSaved,
}: {
  data: ShipmentDetail;
  onSaved: () => void;
}) {
  const { shipment } = data;
  const editable = shipment.status !== "cancelled";
  const [carrier, setCarrier] = useState(shipment.carrier ?? "");
  const [code, setCode] = useState(shipment.tracking_code ?? "");
  const [url, setUrl] = useState(shipment.tracking_url ?? "");
  const [notes, setNotes] = useState(shipment.internal_notes ?? "");
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateShipmentTracking({
        shipmentId: shipment.id,
        carrier,
        trackingCode: code,
        trackingUrl: url,
        internalNotes: notes,
      });
      if (res.ok) {
        toast.success("Rastreio atualizado.");
        onSaved();
      } else {
        toast.error(res.error ?? "Não foi possível salvar.");
      }
    });
  }

  return (
    <div className="space-y-3 text-sm">
      <div className="space-y-1">
        <Label htmlFor="tr-carrier">Transportadora</Label>
        <Input
          id="tr-carrier"
          value={carrier}
          disabled={!editable || pending}
          maxLength={120}
          placeholder="Ex.: Correios, Jadlog, motoboy…"
          onChange={(e) => setCarrier(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="tr-code">Código de rastreio</Label>
        <div className="flex gap-2">
          <Input
            id="tr-code"
            value={code}
            disabled={!editable || pending}
            maxLength={120}
            onChange={(e) => setCode(e.target.value)}
          />
          {shipment.tracking_code ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard
                  .writeText(shipment.tracking_code ?? "")
                  .then(() => toast.success("Código copiado."))
                  .catch(() => toast.error("Não foi possível copiar."));
              }}
            >
              <Copy className="size-4" />
            </Button>
          ) : null}
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="tr-url">URL de rastreio</Label>
        <div className="flex gap-2">
          <Input
            id="tr-url"
            value={url}
            disabled={!editable || pending}
            placeholder="https://…"
            onChange={(e) => setUrl(e.target.value)}
          />
          {shipment.tracking_url ? (
            <a
              href={shipment.tracking_url}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink className="size-4" /> Abrir
            </a>
          ) : null}
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="tr-notes">Nota interna</Label>
        <Textarea
          id="tr-notes"
          rows={2}
          maxLength={2000}
          value={notes}
          disabled={!editable || pending}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {editable ? (
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={pending}>
            {pending ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function AddressTab({
  data,
  onRefreshed,
}: {
  data: ShipmentDetail;
  onRefreshed: () => void;
}) {
  const { shipment, currentAddressId } = data;
  const a = shipment.address_snapshot;
  const [pending, startTransition] = useTransition();
  const stale =
    isShipmentAddressStale(shipment.source_address_id, currentAddressId) &&
    (shipment.status === "draft" || shipment.status === "preparing");

  const lines = [
    a.recipient_name,
    a.cpf ? `CPF ${formatCpf(a.cpf)}` : null,
    `${a.street}, ${a.number}`,
    a.complement || null,
    a.neighborhood,
    `${a.city} / ${a.state}`,
    `CEP ${a.postal_code.replace(/(\d{5})(\d{3})/, "$1-$2")}`,
  ].filter(Boolean) as string[];

  function refresh() {
    startTransition(async () => {
      const res = await refreshShipmentAddress(shipment.id);
      if (res.ok) {
        toast.success("Endereço do envio atualizado.");
        onRefreshed();
      } else {
        toast.error(res.error ?? "Não foi possível atualizar.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {stale ? (
        <div className="rounded-md bg-warning/10 px-3 py-2 text-xs text-warning-foreground">
          <p>Há um endereço mais recente disponível.</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            disabled={pending}
            onClick={refresh}
          >
            <RefreshCw className="size-4" /> Atualizar endereço
          </Button>
        </div>
      ) : null}

      <div className="rounded-lg border p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium">Endereço do envio</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigator.clipboard
                .writeText(lines.join("\n"))
                .then(() => toast.success("Endereço copiado."))
                .catch(() => toast.error("Não foi possível copiar."));
            }}
          >
            <Copy className="size-4" /> Copiar
          </Button>
        </div>
        <address className="mt-2 space-y-0.5 text-sm not-italic">
          {lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </address>
        <p className="mt-2 text-[0.7rem] text-muted-foreground">
          Cópia registrada em {formatDate(shipment.created_at)} — não muda se a
          creator alterar o endereço depois.
        </p>
      </div>
    </div>
  );
}
