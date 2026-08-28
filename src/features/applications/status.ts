import type { ApplicationStatus } from "@/types/database";

/**
 * UI mirror of the DB state machine. `is_valid_application_transition()` in
 * migration 20260828000001 is the source of truth; this table must match it
 * (kept honest by tests/applications-status.test.ts + the integration test).
 */
export const APPLICATION_STATUSES: readonly ApplicationStatus[] = [
  "new",
  "awaiting_review",
  "information_requested",
  "approved",
  "archived",
] as const;

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  new: "Nova",
  awaiting_review: "Aguardando avaliação",
  information_requested: "Informações solicitadas",
  approved: "Aprovada",
  archived: "Arquivada",
};

/** Kanban column order. */
export const KANBAN_COLUMNS: readonly ApplicationStatus[] = APPLICATION_STATUSES;

export const VALID_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  new: ["awaiting_review", "approved", "information_requested", "archived"],
  awaiting_review: ["approved", "information_requested", "archived"],
  information_requested: ["awaiting_review", "approved", "archived"],
  approved: ["archived"],
  archived: ["awaiting_review"],
};

export function canTransition(
  from: ApplicationStatus,
  to: ApplicationStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStatuses(from: ApplicationStatus): ApplicationStatus[] {
  return VALID_TRANSITIONS[from] ?? [];
}

/** Label for the action that moves an application into `to`. */
export const STATUS_ACTION_LABELS: Record<ApplicationStatus, string> = {
  new: "Voltar para Nova",
  awaiting_review: "Marcar para avaliação",
  information_requested: "Solicitar informações",
  approved: "Aprovar",
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
