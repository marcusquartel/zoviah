import {
  FileText,
  MapPin,
  MessageSquare,
  Pencil,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import { APPLICATION_STATUS_LABELS } from "@/features/applications/status";
import { formatDateTime } from "@/features/creators/format";
import type { ApplicationStatus, CreatorEvent } from "@/types/database";

/** Statuses removed with the address step — still named in older events. */
const LEGACY_STATUS_LABELS: Record<string, string> = {
  awaiting_address: "Aguardando endereço",
  completed: "Cadastro completo",
};

const UPDATED_FIELD_LABELS: Record<string, string> = {
  full_name: "nome",
  preferred_name: "nome preferido",
  email: "e-mail",
  phone: "WhatsApp",
  birth_date: "nascimento",
  city: "cidade",
  state: "estado",
  postal_code: "CEP",
  instagram: "Instagram",
  tiktok: "TikTok",
};

function statusLabel(status: string | undefined): string {
  if (!status) return "?";
  return (
    APPLICATION_STATUS_LABELS[status as ApplicationStatus] ??
    LEGACY_STATUS_LABELS[status] ??
    status
  );
}

function describe(event: CreatorEvent): {
  icon: typeof FileText;
  title: string;
  detail?: string;
} {
  const data = event.data ?? {};
  const actor =
    typeof data.actor_email === "string" ? data.actor_email : undefined;

  switch (event.type) {
    case "application_submitted":
      return { icon: UserPlus, title: "Cadastro recebido" };
    case "application_status_changed": {
      const fromLabel = statusLabel(data.from as string | undefined);
      const toLabel = statusLabel(data.to as string | undefined);
      return {
        icon: RefreshCw,
        title: `Status alterado: ${fromLabel} → ${toLabel}`,
        detail: actor ? `por ${actor}` : undefined,
      };
    }
    case "note_added":
      return {
        icon: MessageSquare,
        title: "Nota adicionada",
        detail: typeof data.text === "string" ? data.text : undefined,
      };
    case "address_request_created":
      return {
        icon: MapPin,
        title: "Solicitação de endereço criada",
        detail: actor ? `por ${actor}` : undefined,
      };
    case "address_request_regenerated":
      return {
        icon: MapPin,
        title: "Link de endereço regenerado",
        detail: actor ? `por ${actor}` : undefined,
      };
    case "address_request_revoked":
      return {
        icon: MapPin,
        title: "Solicitação de endereço revogada",
        detail: actor ? `por ${actor}` : undefined,
      };
    case "affiliation_imported":
      return {
        icon: FileText,
        title: `Cupom ${typeof data.code === "string" ? data.code : ""} vinculado`,
        detail: actor ? `por ${actor}` : undefined,
      };
    case "address_submitted":
      return {
        icon: MapPin,
        title:
          data.source === "signup"
            ? "Endereço informado na inscrição"
            : data.source === "manual"
              ? "Endereço preenchido pela equipe"
              : "Endereço enviado pela creator",
        detail: actor ? `por ${actor}` : undefined,
      };
    case "creator_updated": {
      const fields = Array.isArray(data.fields)
        ? (data.fields as string[]).map((f) => UPDATED_FIELD_LABELS[f] ?? f)
        : [];
      return {
        icon: Pencil,
        title: "Dados atualizados",
        detail: [fields.join(", "), actor ? `por ${actor}` : ""]
          .filter(Boolean)
          .join(" · "),
      };
    }
    default:
      return { icon: FileText, title: event.type };
  }
}

export function Timeline({ events }: { events: CreatorEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nenhum evento ainda.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {events.map((event) => {
        const { icon: Icon, title, detail } = describe(event);
        return (
          <li key={event.id} className="flex gap-3">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <Icon className="size-3.5 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{title}</p>
              {detail ? (
                <p className="text-sm text-muted-foreground">{detail}</p>
              ) : null}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDateTime(event.created_at)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
