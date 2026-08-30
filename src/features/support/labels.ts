/**
 * Portuguese labels for support enums, plus the AI-resolution-rate formula.
 * Everything here is pure and unit-tested.
 */
import type {
  SupportConversationStatus,
  SupportMessageRole,
  SupportTicketPriority,
  SupportTicketStatus,
  SupportTicketType,
  HelpArticleStatus,
} from "@/types/database";

export const TICKET_STATUS_LABELS: Record<SupportTicketStatus, string> = {
  open: "Aberto",
  in_progress: "Em andamento",
  resolved: "Resolvido",
  closed: "Fechado",
};

export const TICKET_PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  critical: "Crítica",
};

export const TICKET_TYPE_LABELS: Record<SupportTicketType, string> = {
  question: "Dúvida",
  account: "Conta",
  bug: "Erro",
  feature_request: "Sugestão",
  other: "Outro",
};

export const CONVERSATION_STATUS_LABELS: Record<
  SupportConversationStatus,
  string
> = {
  open: "Aberta",
  resolved: "Resolvida",
  escalated: "Encaminhada",
};

export const MESSAGE_ROLE_LABELS: Record<SupportMessageRole, string> = {
  user: "Você",
  assistant: "Assistente",
  system_event: "Evento",
};

export const ARTICLE_STATUS_LABELS: Record<HelpArticleStatus, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

export const HELP_CATEGORIES = [
  "Primeiros passos",
  "Creators",
  "Programas",
  "Formulários",
  "Creator Score",
  "Métricas / Evidências",
  "Aprovação",
  "Endereço",
  "Envios",
  "Equipe",
  "Configurações",
  "Suporte",
] as const;

export type HelpCategory = (typeof HELP_CATEGORIES)[number];

/**
 * AI Resolution Rate (§ support overview).
 *
 *   rate = conversations resolved by the AI / conversations that reached a
 *          conclusion (resolved by AI, or escalated to a human)
 *
 * Conversations still open — the user simply walked away — are NOT in the
 * denominator: they are neither a win nor a loss yet. Returns `null` when
 * there is no signal at all, so the UI shows "—" instead of a fake 0%.
 */
export function aiResolutionRate(input: {
  aiResolved: number;
  escalated: number;
}): number | null {
  const denom = input.aiResolved + input.escalated;
  if (denom <= 0) return null;
  return input.aiResolved / denom;
}

export function formatRate(rate: number | null): string {
  if (rate === null) return "—";
  return `${Math.round(rate * 100)}%`;
}
