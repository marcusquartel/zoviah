import { z } from "zod";

/**
 * Server-side schemas for shipment items, tracking and notes (Phase 5 §82).
 * The `create_shipment` / `update_shipment_*` RPCs re-validate in SQL — these
 * are never the only gate.
 */
export const shipmentItemSchema = z.object({
  itemName: z
    .string()
    .trim()
    .min(1, { error: "Informe o item." })
    .max(200, { error: "Nome do item muito longo." }),
  sku: z
    .string()
    .trim()
    .max(100, { error: "SKU muito longo." })
    .optional()
    .default(""),
  quantity: z.coerce
    .number()
    .int({ error: "Quantidade deve ser um número inteiro." })
    .min(1, { error: "Quantidade mínima é 1." })
    .max(999, { error: "Quantidade máxima é 999." }),
});

export const shipmentItemsSchema = z
  .array(shipmentItemSchema)
  .min(1, { error: "Adicione ao menos um item." })
  .max(50, { error: "No máximo 50 itens por envio." });

/** http(s) only — no javascript:/data: etc. Empty string = "no URL". */
const trackingUrl = z
  .string()
  .trim()
  .max(2000)
  .refine(
    (v) => {
      if (v === "") return true;
      if (!/^https?:\/\//i.test(v)) return false;
      try {
        new URL(v);
        return true;
      } catch {
        return false;
      }
    },
    { error: "A URL de rastreio deve começar com http:// ou https://." },
  )
  .default("");

export const trackingSchema = z.object({
  carrier: z.string().trim().max(120, { error: "Transportadora muito longa." }).default(""),
  trackingCode: z
    .string()
    .trim()
    .max(120, { error: "Código de rastreio muito longo." })
    .default(""),
  trackingUrl,
  internalNotes: z
    .string()
    .trim()
    .max(2000, { error: "A nota interna aceita no máximo 2000 caracteres." })
    .default(""),
});

export type ShipmentItemInput = z.infer<typeof shipmentItemSchema>;
export type TrackingInput = z.infer<typeof trackingSchema>;

/** Items array -> the snake_case payload the RPC expects. */
export function toItemsPayload(items: ShipmentItemInput[]) {
  return items.map((it) => ({
    item_name: it.itemName,
    sku: it.sku ? it.sku : null,
    quantity: it.quantity,
  }));
}
