/**
 * Portuguese labels for product-feedback enums. Pure, unit-tested.
 *
 * §37 — voting is "1 voto oficial por organização", NOT per user: twenty seats
 * at the same company must not inflate a request. That rule lives in the
 * `feature_request_votes` unique(organization_id, request_id) constraint; the
 * UI copy here reflects it ("voto da organização").
 *
 * §39 — the roadmap never shows a date or a promised deadline. There is no
 * date field on `roadmap_items` and no label here implies one.
 */
import type {
  FeatureRequestFrequency,
  FeatureRequestImportance,
  FeatureRequestStatus,
  RoadmapItemStatus,
  ChangelogStatus,
} from "@/types/database";

export const FEATURE_STATUS_LABELS: Record<FeatureRequestStatus, string> = {
  submitted: "Enviada",
  under_review: "Em avaliação",
  planned: "Planejada",
  in_progress: "Em desenvolvimento",
  released: "Lançada",
  declined: "Não planejada",
};

export const FREQUENCY_LABELS: Record<FeatureRequestFrequency, string> = {
  rarely: "Raramente",
  sometimes: "Às vezes",
  often: "Com frequência",
  daily: "Diariamente",
};

export const IMPORTANCE_LABELS: Record<FeatureRequestImportance, string> = {
  nice_to_have: "Seria bom ter",
  important: "Importante",
  essential: "Essencial",
};

export const ROADMAP_STATUS_LABELS: Record<RoadmapItemStatus, string> = {
  under_consideration: "Em avaliação",
  planned: "Planejado",
  in_progress: "Em desenvolvimento",
  released: "Lançado",
};

/** Display order for roadmap columns — active work first, shipped last. */
export const ROADMAP_STATUS_ORDER: RoadmapItemStatus[] = [
  "in_progress",
  "planned",
  "under_consideration",
  "released",
];

export const CHANGELOG_STATUS_LABELS: Record<ChangelogStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
};

export const VOTE_SCOPE_NOTE =
  "Cada organização tem um voto por sugestão — vários membros da mesma empresa não somam votos.";
