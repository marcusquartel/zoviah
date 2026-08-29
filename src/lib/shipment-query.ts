// Relative imports so this module stays importable by the node test runner.
import type { ShipmentStatus } from "@/types/database";

export const SHIPMENT_SORTS = [
  "recent",
  "oldest",
  "shipped_recent",
  "creator_asc",
] as const;
export type ShipmentSort = (typeof SHIPMENT_SORTS)[number];

export const SHIPMENT_SORT_LABELS: Record<ShipmentSort, string> = {
  recent: "Mais recentes",
  oldest: "Mais antigos",
  shipped_recent: "Enviados recentemente",
  creator_asc: "Creator A–Z",
};

export type ShipmentView = "list" | "kanban";

const SHIPMENT_STATUS_VALUES: readonly ShipmentStatus[] = [
  "draft",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
];

export interface ShipmentQuery {
  q: string;
  status: ShipmentStatus | null;
  program: string | null;
  carrier: string | null;
  createdFrom: string | null;
  sort: ShipmentSort;
  view: ShipmentView;
  page: number;
}

export const DEFAULT_SHIPMENT_QUERY: ShipmentQuery = {
  q: "",
  status: null,
  program: null,
  carrier: null,
  createdFrom: null,
  sort: "recent",
  view: "list",
  page: 1,
};

type ParamInput =
  | URLSearchParams
  | Record<string, string | string[] | undefined>;

function get(sp: ParamInput, key: string): string | undefined {
  if (sp instanceof URLSearchParams) return sp.get(key) ?? undefined;
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export function parseShipmentQuery(sp: ParamInput): ShipmentQuery {
  const rawSort = get(sp, "sort");
  const sort = (SHIPMENT_SORTS as readonly string[]).includes(rawSort ?? "")
    ? (rawSort as ShipmentSort)
    : "recent";
  const view: ShipmentView = get(sp, "view") === "kanban" ? "kanban" : "list";
  const pageNum = Number.parseInt(get(sp, "page") ?? "1", 10);
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;
  const rawStatus = get(sp, "status");
  const status = (SHIPMENT_STATUS_VALUES as readonly string[]).includes(
    rawStatus ?? "",
  )
    ? (rawStatus as ShipmentStatus)
    : null;
  const trim = (k: string) => {
    const v = get(sp, k)?.trim();
    return v ? v : null;
  };
  const createdFrom = get(sp, "from")?.trim();

  return {
    q: get(sp, "q")?.trim() ?? "",
    status,
    program: trim("program"),
    carrier: trim("carrier"),
    createdFrom:
      createdFrom && /^\d{4}-\d{2}-\d{2}$/.test(createdFrom) ? createdFrom : null,
    sort,
    view,
    page,
  };
}

export function serializeShipmentQuery(q: Partial<ShipmentQuery>): string {
  const merged = { ...DEFAULT_SHIPMENT_QUERY, ...q };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.status) params.set("status", merged.status);
  if (merged.program) params.set("program", merged.program);
  if (merged.carrier) params.set("carrier", merged.carrier);
  if (merged.createdFrom) params.set("from", merged.createdFrom);
  if (merged.sort !== "recent") params.set("sort", merged.sort);
  if (merged.view !== "list") params.set("view", merged.view);
  if (merged.page > 1) params.set("page", String(merged.page));
  return params.toString();
}

export function shipmentFiltersActive(q: ShipmentQuery): boolean {
  return Boolean(
    q.q || q.status || q.program || q.carrier || q.createdFrom,
  );
}
