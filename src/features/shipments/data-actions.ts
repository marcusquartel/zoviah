"use server";

import { getShipmentDetail, type ShipmentDetail } from "@/features/shipments/queries";

/** Full shipment detail incl. address_snapshot — loaded only when the modal opens. */
export async function loadShipmentDetail(
  shipmentId: string,
): Promise<ShipmentDetail | null> {
  return getShipmentDetail(shipmentId);
}
