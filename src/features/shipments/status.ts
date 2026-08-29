import type { ShipmentStatus } from "@/types/database";

/**
 * Shipment state machine, mirrored from `is_valid_shipment_transition()` in
 * migration 20260829000004 (the DB is the final authority). Kept honest by
 * tests/shipment-status.test.ts + the integration tests.
 *
 * `delivered → shipped` and `shipped → preparing` are operational corrections
 * for a mis-click; `transition_shipment_status` clears the affected timestamps.
 */
export const SHIPMENT_STATUSES: readonly ShipmentStatus[] = [
  "draft",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  draft: "Rascunho",
  preparing: "Preparando",
  shipped: "Enviado",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

/** Kanban column order. */
export const SHIPMENT_KANBAN_COLUMNS: readonly ShipmentStatus[] =
  SHIPMENT_STATUSES;

export const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  draft: ["preparing", "cancelled"],
  preparing: ["draft", "shipped", "cancelled"],
  shipped: ["delivered", "preparing"],
  delivered: ["shipped"],
  cancelled: ["draft"],
};

export function canTransitionShipment(
  from: ShipmentStatus,
  to: ShipmentStatus,
): boolean {
  return SHIPMENT_TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextShipmentStatuses(from: ShipmentStatus): ShipmentStatus[] {
  return SHIPMENT_TRANSITIONS[from] ?? [];
}

/** Label for the action button that moves a shipment into `to`. */
export function shipmentActionLabel(
  from: ShipmentStatus,
  to: ShipmentStatus,
): string {
  const map: Record<string, string> = {
    "draft>preparing": "Começar preparação",
    "preparing>draft": "Voltar para rascunho",
    "preparing>shipped": "Marcar enviado",
    "shipped>delivered": "Marcar entregue",
    "shipped>preparing": "Corrigir: voltar para preparando",
    "delivered>shipped": "Corrigir: voltar para enviado",
    "cancelled>draft": "Restaurar",
  };
  if (to === "cancelled") return "Cancelar";
  return map[`${from}>${to}`] ?? SHIPMENT_STATUS_LABELS[to];
}

/** The shipment carries a stale address when its source differs from the
 *  creator's current address (§68). Only a hint — never a field-by-field diff. */
export function isShipmentAddressStale(
  shipmentSourceAddressId: string,
  currentAddressId: string | null,
): boolean {
  return (
    currentAddressId != null && currentAddressId !== shipmentSourceAddressId
  );
}
