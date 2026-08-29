"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import {
  shipmentItemsSchema,
  trackingSchema,
  toItemsPayload,
} from "@/lib/validation/shipment";
import { SHIPMENT_STATUSES } from "@/features/shipments/status";
import { parseShipmentQuery } from "@/lib/shipment-query";
import { listShipments, type ShipmentListPage } from "@/features/shipments/queries";
import type { ShipmentStatus } from "@/types/database";

export interface ShipmentActionResult {
  ok: boolean;
  error?: string;
  shipmentId?: string;
}

const idSchema = z.uuid();

const RPC_ERRORS: Record<string, string> = {
  NOT_AUTHENTICATED: "Sessão expirada. Entre novamente.",
  FORBIDDEN: "Você não tem acesso a este envio.",
  APPLICATION_NOT_FOUND: "Inscrição não encontrada.",
  SHIPMENT_NOT_FOUND: "Envio não encontrado.",
  APPLICATION_NOT_COMPLETED:
    "Só é possível criar envio para uma creator com cadastro completo.",
  NO_CURRENT_ADDRESS:
    "Esta creator ainda não possui endereço disponível para envio.",
  INVALID_ITEMS: "Confira os itens do envio.",
  INVALID_TRACKING: "Confira os dados de rastreio.",
  INVALID_NOTES: "A nota interna é muito longa.",
  ITEMS_LOCKED: "Os itens não podem mais ser alterados neste envio.",
  ADDRESS_LOCKED: "O endereço deste envio não pode mais ser atualizado.",
  NO_ITEMS: "Adicione ao menos um item antes de avançar.",
  SHIPMENT_CANCELLED: "Este envio está cancelado.",
  INVALID_TRANSITION: "Essa mudança de status não é permitida.",
};

function mapError(message: string | undefined): string {
  if (message) {
    for (const key of Object.keys(RPC_ERRORS)) {
      if (message.includes(key)) return RPC_ERRORS[key];
    }
  }
  return "Não foi possível concluir a ação.";
}

function revalidate() {
  revalidatePath("/app/shipments");
  revalidatePath("/app/creators");
  revalidatePath("/app");
}

interface RawItem {
  itemName: string;
  sku?: string;
  quantity: number | string;
}

export async function createShipment(input: {
  applicationId: string;
  items: RawItem[];
  internalNotes?: string;
}): Promise<ShipmentActionResult> {
  const appId = idSchema.safeParse(input.applicationId);
  if (!appId.success) return { ok: false, error: "Inscrição inválida." };
  const items = shipmentItemsSchema.safeParse(input.items);
  if (!items.success) {
    return {
      ok: false,
      error: items.error.issues[0]?.message ?? "Confira os itens.",
    };
  }
  const notes = (input.internalNotes ?? "").trim().slice(0, 2000);

  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_shipment", {
    p_application_id: appId.data,
    p_items: toItemsPayload(items.data) as never,
    p_internal_notes: notes.length > 0 ? notes : undefined,
  });
  if (error) {
    console.error("[create_shipment]", error.code, error.message);
    return { ok: false, error: mapError(error.message) };
  }
  revalidate();
  return { ok: true, shipmentId: (data as { shipment_id?: string })?.shipment_id };
}

export async function updateShipmentItems(input: {
  shipmentId: string;
  items: RawItem[];
}): Promise<ShipmentActionResult> {
  const id = idSchema.safeParse(input.shipmentId);
  if (!id.success) return { ok: false, error: "Envio inválido." };
  const items = shipmentItemsSchema.safeParse(input.items);
  if (!items.success) {
    return {
      ok: false,
      error: items.error.issues[0]?.message ?? "Confira os itens.",
    };
  }

  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_shipment_items", {
    p_shipment_id: id.data,
    p_items: toItemsPayload(items.data) as never,
  });
  if (error) {
    console.error("[update_shipment_items]", error.code, error.message);
    return { ok: false, error: mapError(error.message) };
  }
  revalidate();
  return { ok: true };
}

export async function updateShipmentTracking(input: {
  shipmentId: string;
  carrier?: string;
  trackingCode?: string;
  trackingUrl?: string;
  internalNotes?: string;
}): Promise<ShipmentActionResult> {
  const id = idSchema.safeParse(input.shipmentId);
  if (!id.success) return { ok: false, error: "Envio inválido." };
  const parsed = trackingSchema.safeParse({
    carrier: input.carrier ?? "",
    trackingCode: input.trackingCode ?? "",
    trackingUrl: input.trackingUrl ?? "",
    internalNotes: input.internalNotes ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Confira os dados de rastreio.",
    };
  }

  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_shipment_tracking", {
    p_shipment_id: id.data,
    p_carrier: parsed.data.carrier || null,
    p_tracking_code: parsed.data.trackingCode || null,
    p_tracking_url: parsed.data.trackingUrl || null,
    p_internal_notes: parsed.data.internalNotes || null,
  });
  if (error) {
    console.error("[update_shipment_tracking]", error.code, error.message);
    return { ok: false, error: mapError(error.message) };
  }
  revalidate();
  return { ok: true };
}

const statusSchema = z.enum(
  SHIPMENT_STATUSES as [ShipmentStatus, ...ShipmentStatus[]],
);

export async function transitionShipmentStatus(input: {
  shipmentId: string;
  toStatus: ShipmentStatus;
}): Promise<ShipmentActionResult> {
  const id = idSchema.safeParse(input.shipmentId);
  const to = statusSchema.safeParse(input.toStatus);
  if (!id.success || !to.success) return { ok: false, error: "Dados inválidos." };

  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_shipment_status", {
    p_shipment_id: id.data,
    p_to_status: to.data,
  });
  if (error) {
    console.error("[transition_shipment_status]", error.code, error.message);
    return { ok: false, error: mapError(error.message) };
  }
  revalidate();
  return { ok: true };
}

export async function refreshShipmentAddress(
  shipmentId: string,
): Promise<ShipmentActionResult> {
  const id = idSchema.safeParse(shipmentId);
  if (!id.success) return { ok: false, error: "Envio inválido." };

  const current = await getCurrentOrganization();
  if (!current) return { ok: false, error: "Organização não encontrada." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("refresh_shipment_address", {
    p_shipment_id: id.data,
  });
  if (error) {
    console.error("[refresh_shipment_address]", error.code, error.message);
    return { ok: false, error: mapError(error.message) };
  }
  revalidate();
  return { ok: true };
}

/** "Carregar mais" on the /app/shipments list. */
export async function loadMoreShipments(
  search: string,
  page: number,
): Promise<ShipmentListPage> {
  const query = parseShipmentQuery(new URLSearchParams(search));
  return listShipments({ ...query, page: Math.max(1, page) });
}
