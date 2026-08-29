import {
  FileText,
  MapPin,
  MessageSquare,
  RefreshCw,
  UserPlus,
} from "lucide-react";
import { APPLICATION_STATUS_LABELS } from "@/features/applications/status";
import { formatDateTime } from "@/features/creators/format";
import type { ApplicationStatus, CreatorEvent } from "@/types/database";

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
      const from = data.from as ApplicationStatus | undefined;
      const to = data.to as ApplicationStatus | undefined;
      const fromLabel = from ? APPLICATION_STATUS_LABELS[from] : "?";
      const toLabel = to ? APPLICATION_STATUS_LABELS[to] : "?";
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
    case "address_submitted":
      return { icon: MapPin, title: "Endereço enviado pela creator" };
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
