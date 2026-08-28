// Relative (not "@/") so this module stays importable by the node test runner,
// which does not resolve the "@/" path alias.
import { APPLICATION_STATUSES } from "../features/applications/status.ts";
import type { ApplicationStatus } from "@/types/database";

export const CREATOR_SORTS = [
  "recent",
  "oldest",
  "name_asc",
  "name_desc",
  "ig_desc",
  "tt_desc",
] as const;
export type CreatorSort = (typeof CREATOR_SORTS)[number];

export const SORT_LABELS: Record<CreatorSort, string> = {
  recent: "Mais recentes",
  oldest: "Mais antigas",
  name_asc: "Nome A–Z",
  name_desc: "Nome Z–A",
  ig_desc: "Maior Instagram",
  tt_desc: "Maior TikTok",
};

export type CreatorView = "list" | "kanban";

export interface CreatorQuery {
  q: string;
  program: string | null;
  status: ApplicationStatus | null;
  city: string | null;
  state: string | null;
  duplicate: boolean;
  hasInstagram: boolean;
  hasTiktok: boolean;
  sort: CreatorSort;
  view: CreatorView;
  page: number;
}

export const DEFAULT_CREATOR_QUERY: CreatorQuery = {
  q: "",
  program: null,
  status: null,
  city: null,
  state: null,
  duplicate: false,
  hasInstagram: false,
  hasTiktok: false,
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

export function parseCreatorQuery(sp: ParamInput): CreatorQuery {
  const rawStatus = get(sp, "status");
  const status = APPLICATION_STATUSES.includes(rawStatus as ApplicationStatus)
    ? (rawStatus as ApplicationStatus)
    : null;

  const rawSort = get(sp, "sort");
  const sort = (CREATOR_SORTS as readonly string[]).includes(rawSort ?? "")
    ? (rawSort as CreatorSort)
    : "recent";

  const view: CreatorView = get(sp, "view") === "kanban" ? "kanban" : "list";

  const pageNum = Number.parseInt(get(sp, "page") ?? "1", 10);
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;

  const trim = (k: string) => {
    const v = get(sp, k)?.trim();
    return v ? v : null;
  };

  return {
    q: get(sp, "q")?.trim() ?? "",
    program: trim("program"),
    status,
    city: trim("city"),
    state: trim("state"),
    duplicate: get(sp, "duplicate") === "1",
    hasInstagram: get(sp, "has_ig") === "1",
    hasTiktok: get(sp, "has_tt") === "1",
    sort,
    view,
    page,
  };
}

/** Serialize a query to a `?a=b&c=d` string, omitting defaults. */
export function serializeCreatorQuery(q: Partial<CreatorQuery>): string {
  const merged = { ...DEFAULT_CREATOR_QUERY, ...q };
  const params = new URLSearchParams();

  if (merged.q) params.set("q", merged.q);
  if (merged.program) params.set("program", merged.program);
  if (merged.status) params.set("status", merged.status);
  if (merged.city) params.set("city", merged.city);
  if (merged.state) params.set("state", merged.state);
  if (merged.duplicate) params.set("duplicate", "1");
  if (merged.hasInstagram) params.set("has_ig", "1");
  if (merged.hasTiktok) params.set("has_tt", "1");
  if (merged.sort !== "recent") params.set("sort", merged.sort);
  if (merged.view !== "list") params.set("view", merged.view);
  if (merged.page > 1) params.set("page", String(merged.page));

  return params.toString();
}

/** True when any filter/search (not view/sort/page) is active. */
export function hasActiveFilters(q: CreatorQuery): boolean {
  return Boolean(
    q.q ||
      q.program ||
      q.status ||
      q.city ||
      q.state ||
      q.duplicate ||
      q.hasInstagram ||
      q.hasTiktok,
  );
}
