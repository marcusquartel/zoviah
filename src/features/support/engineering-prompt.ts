/**
 * "Preparar para engenharia" (§23, §24).
 *
 * Turns a support ticket into a structured prompt an operator can COPY into
 * Claude Code manually. This phase does NOT send it anywhere, does NOT run
 * Claude Code, does NOT open a PR — the function returns a string and stops.
 *
 * §24 — the prompt always carries the engineering constraints, and it MUST NOT
 * contain operational PII: no address, no raw token, no API key, no password.
 * `sanitizeForEngineering` scrubs the free-text fields before they are
 * embedded; `buildEngineeringPrompt` is otherwise a pure template.
 */

const ENGINEERING_CONSTRAINTS = [
  "Preserve o RLS existente. Nenhuma policy pode ser enfraquecida.",
  "Crie um teste de regressão que cubra o cenário relatado.",
  "NÃO altere migrations já aplicadas — crie uma nova migration sequencial se precisar de mudança de schema.",
  "NÃO use dados reais de clientes em testes ou fixtures.",
  "NÃO exponha PII (endereço, CPF, telefone, e-mail de creator) em logs, respostas de API ou mensagens de erro.",
  "Mantenha a suíte padrão sem chamadas pagas de IA.",
];

/** Patterns that must never survive into an engineering prompt. */
const SCRUBBERS: { re: RegExp; label: string }[] = [
  // e-mail addresses
  { re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, label: "[e-mail removido]" },
  // Brazilian CPF (with or without punctuation)
  { re: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, label: "[cpf removido]" },
  // CEP
  { re: /\b\d{5}-?\d{3}\b/g, label: "[cep removido]" },
  // long phone runs
  { re: /\b(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}\b/g, label: "[telefone removido]" },
  // anything that looks like an API key / bearer token / secret
  { re: /\b(sk-[A-Za-z0-9_-]{12,}|sb_[A-Za-z0-9_-]{12,}|Bearer\s+[A-Za-z0-9._-]{12,})\b/g, label: "[credencial removida]" },
  // hex/base64url blobs 24+ chars — likely a token hash or secret
  { re: /\b[A-Za-z0-9_-]{40,}\b/g, label: "[token removido]" },
];

export function sanitizeForEngineering(text: string): string {
  let out = text ?? "";
  for (const { re, label } of SCRUBBERS) out = out.replace(re, label);
  return out.trim();
}

export interface EngineeringPromptInput {
  ticketId: string;
  type: string;
  subject: string;
  description: string;
  module: string | null;
  currentRoute: string | null;
  /** The user↔assistant exchange, oldest first. Never includes system secrets. */
  conversation?: { role: string; content: string }[];
  /** Titles of the help articles the assistant leaned on, if any. */
  articleTitles?: string[];
}

export function buildEngineeringPrompt(input: EngineeringPromptInput): string {
  const convo =
    input.conversation && input.conversation.length > 0
      ? input.conversation
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map(
            (m) =>
              `- ${m.role === "user" ? "Cliente" : "Assistente"}: ${sanitizeForEngineering(m.content)}`,
          )
          .join("\n")
      : "(sem histórico de conversa)";

  const articles =
    input.articleTitles && input.articleTitles.length > 0
      ? input.articleTitles.map((t) => `- ${t}`).join("\n")
      : "(nenhum artigo consultado)";

  return [
    `# Tarefa de engenharia — ticket ${input.ticketId}`,
    "",
    "## Contexto",
    `- Tipo: ${input.type}`,
    `- Módulo: ${input.module ?? "não informado"}`,
    `- Tela: ${input.currentRoute ?? "não informada"}`,
    "",
    "## Relato do cliente",
    `**${sanitizeForEngineering(input.subject)}**`,
    "",
    sanitizeForEngineering(input.description),
    "",
    "## Conversa com o assistente",
    convo,
    "",
    "## Artigos de ajuda consultados",
    articles,
    "",
    "## Restrições obrigatórias",
    ...ENGINEERING_CONSTRAINTS.map((c) => `- ${c}`),
    "",
    "## Entregável",
    "- Diagnóstico da causa raiz.",
    "- Correção mínima e localizada.",
    "- Teste de regressão novo, verde.",
    "- Sem alterar migrations já aplicadas; sem dados reais em teste; sem PII em log.",
    "",
    "> Gerado para cópia manual. Não enviar automaticamente, não executar, não abrir PR.",
  ].join("\n");
}

export { ENGINEERING_CONSTRAINTS };
