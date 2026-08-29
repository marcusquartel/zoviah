// Relative (not "@/") so this module stays importable by the node test runner,
// which does not resolve the "@/" path alias.
import { APPLICATION_STATUSES } from "../features/applications/status.ts";
import type {
  AnalysisConfidence,
  AnalysisTier,
  ApplicationAnalysisStatus,
  ApplicationStatus,
} from "@/types/database";

export const CREATOR_SORTS = [
  "recent",
  "oldest",
  "name_asc",
  "name_desc",
  "ig_desc",
  "tt_desc",
  "score_desc",
  "score_asc",
] as const;
export type CreatorSort = (typeof CREATOR_SORTS)[number];

export const SORT_LABELS: Record<CreatorSort, string> = {
  recent: "Mais recentes",
  oldest: "Mais antigas",
  name_asc: "Nome A–Z",
  name_desc: "Nome Z–A",
  ig_desc: "Maior Instagram",
  tt_desc: "Maior TikTok",
  score_desc: "Maior score",
  score_asc: "Menor score",
};

export type CreatorView = "list" | "kanban";

export const ANALYSIS_STATUS_VALUES: readonly ApplicationAnalysisStatus[] = [
  "not_analyzed",
  "processing",
  "completed",
  "failed",
];
export const TIER_VALUES: readonly AnalysisTier[] = ["A", "B", "C", "D"];
export const CONFIDENCE_VALUES: readonly AnalysisConfidence[] = [
  "low",
  "medium",
  "high",
];

export interface CreatorQuery {
  q: string;
  program: string | null;
  status: ApplicationStatus | null;
  city: string | null;
  state: string | null;
  hasInstagram: boolean;
  hasTiktok: boolean;
  analysisStatus: ApplicationAnalysisStatus | null;
  tier: AnalysisTier | null;
  confidence: AnalysisConfidence | null;
  minScore: number | null;
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
  hasInstagram: false,
  hasTiktok: false,
  analysisStatus: null,
  tier: null,
  confidence: null,
  minScore: null,
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

function oneOf<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | null {
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

export function parseCreatorQuery(sp: ParamInput): CreatorQuery {
  const rawSort = get(sp, "sort");
  const sort = (CREATOR_SORTS as readonly string[]).includes(rawSort ?? "")
    ? (rawSort as CreatorSort)
    : "recent";

  const view: CreatorView = get(sp, "view") === "kanban" ? "kanban" : "list";

  const pageNum = Number.parseInt(get(sp, "page") ?? "1", 10);
  const page = Number.isFinite(pageNum) && pageNum > 0 ? pageNum : 1;

  const minScoreNum = Number.parseInt(get(sp, "min_score") ?? "", 10);
  const minScore =
    Number.isFinite(minScoreNum) && minScoreNum > 0
      ? Math.min(100, minScoreNum)
      : null;

  const trim = (k: string) => {
    const v = get(sp, k)?.trim();
    return v ? v : null;
  };

  return {
    q: get(sp, "q")?.trim() ?? "",
    program: trim("program"),
    status: oneOf(get(sp, "status"), APPLICATION_STATUSES),
    city: trim("city"),
    state: trim("state"),
    hasInstagram: get(sp, "has_ig") === "1",
    hasTiktok: get(sp, "has_tt") === "1",
    analysisStatus: oneOf(get(sp, "analysis"), ANALYSIS_STATUS_VALUES),
    tier: oneOf(get(sp, "tier"), TIER_VALUES),
    confidence: oneOf(get(sp, "confidence"), CONFIDENCE_VALUES),
    minScore,
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
  if (merged.hasInstagram) params.set("has_ig", "1");
  if (merged.hasTiktok) params.set("has_tt", "1");
  if (merged.analysisStatus) params.set("analysis", merged.analysisStatus);
  if (merged.tier) params.set("tier", merged.tier);
  if (merged.confidence) params.set("confidence", merged.confidence);
  if (merged.minScore != null) params.set("min_score", String(merged.minScore));
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
      q.hasInstagram ||
      q.hasTiktok ||
      q.analysisStatus ||
      q.tier ||
      q.confidence ||
      q.minScore != null,
  );
}
