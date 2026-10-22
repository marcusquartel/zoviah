import type { ContentFormat, ContentPlatform, ContentStatus } from "@/types/database";

export const PLATFORM_LABELS: Record<ContentPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};

export const FORMAT_LABELS: Record<ContentFormat, string> = {
  post: "Post",
  reel: "Reels",
  story: "Story",
  video: "Vídeo",
};

/** Formats each network offers (TikTok has no "post"/"reels"; Instagram no "vídeo"). */
export const FORMATS_BY_PLATFORM: Record<ContentPlatform, ContentFormat[]> = {
  instagram: ["post", "reel", "story"],
  tiktok: ["video", "story"],
};

export const STATUS_LABELS: Record<ContentStatus, string> = {
  pending: "Em análise",
  approved: "Aprovado",
  rejected: "Recusado",
};

export const CONTENT_ERRORS: Record<string, string> = {
  NOT_AUTHENTICATED: "Sessão expirada. Entre novamente.",
  FORBIDDEN: "Você não tem permissão para isso.",
  CREATOR_NOT_FOUND: "Creator não encontrada.",
  CONTENT_NOT_FOUND: "Publicação não encontrada.",
  INVALID_PLATFORM: "Escolha a rede social.",
  INVALID_FORMAT: "Escolha o tipo de publicação.",
  PROOF_REQUIRED: "Envie o link ou um print da publicação.",
  INVALID_URL: "Link inválido para essa rede social.",
  INVALID_SCREENSHOT: "Print inválido. Envie a imagem de novo.",
  INVALID_DATE: "Data inválida.",
  DUPLICATE_URL: "Essa publicação já foi registrada.",
  INVALID_STATUS: "Status inválido.",
  INVALID_PAYLOAD: "Revise os dados.",
};

export function mapContentError(message: string | undefined, fallback: string): string {
  if (message) {
    for (const k of Object.keys(CONTENT_ERRORS)) if (message.includes(k)) return CONTENT_ERRORS[k];
  }
  return fallback;
}
