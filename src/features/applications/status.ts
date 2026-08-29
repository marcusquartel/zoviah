import type { ApplicationStatus } from "@/types/database";

/**
 * UI mirror of the DB state machine. `is_valid_application_transition()` in
 * migration 20260829000002 is the source of truth for the *full* conceptual
 * graph; `VALID_TRANSITIONS` mirrors it (kept honest by
 * tests/applications-status.test.ts + the integration tests).
 *
 * Two edges are "secure-only": they belong to the address-request flow and are
 * refused by `transition_application_status` for a manual caller. The status
 * dropdowns therefore use `nextStatuses()`, which hides them.
 */
export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "new",
  "awaiting_review",
  "information_requested",
  "approved",
  "awaiting_address",
  "completed",
  "archived",
] as const;

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: "Nova",
  awaiting_review: "Aguardando avaliação",
  information_requested: "Informações solicitadas",
  approved: "Aprovada",
  awaiting_address: "Aguardando endereço",
  completed: "Cadastro completo",
  archived: "Arquivada",
};

/** Kanban column order. */
export const KANBAN_COLUMNS: readonly ApplicationStatus[] = APPLICATION_STATUSES;

/** Full conceptual graph — mirrors is_valid_application_transition(). */
export const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  new: ["awaiting_review", "approved", "information_requested", "archived"],
  awaiting_review: ["approved", "information_requested", "archived"],
  information_requested: ["awaiting_review", "approved", "archived"],
  approved: ["archived", "awaiting_address"],
  awaiting_address: ["completed", "approved", "archived"],
  completed: ["archived"],
  archived: ["awaiting_review"],
};

/**
 * Edges that only ever happen inside a SECURITY DEFINER address-request RPC —
 * never offered as a manual status change.
 */
export const SECURE_ONLY_TRANSITIONS: ReadonlySet<string> = new Set([
  "approved>awaiting_address",
  "awaiting_address>completed",
  "awaiting_address>approved",
]);

export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Transitions a human may pick from a dropdown (secure-only edges removed). */
export function nextStatuses(from: ApplicationStatus): ApplicationStatus[] {
  return (VALID_TRANSITIONS[from] ?? []).filter(
    (to) => !SECURE_ONLY_TRANSITIONS.has(`${from}>${to}`),
  );
}

/** Label for the action that moves an application into `to`. */
export const STATUS_ACTION_LABELS: Record<ApplicationStatus, string> = {
  new: "Voltar para Nova",
  awaiting_review: "Marcar para avaliação",
  information_requested: "Solicitar informações",
  approved: "Aprovar",
  awaiting_address: "Aguardando endereço",
  completed: "Cadastro completo",
  archived: "Arquivar",
};

/** "Reabrir" reads better than "Marcar para avaliação" when coming from archived. */
export function statusActionLabel(
  from: ApplicationStatus,
  to: ApplicationStatus,
): string {
  if (from === "archived" && to === "awaiting_review") return "Reabrir";
  return STATUS_ACTION_LABELS[to];
}
