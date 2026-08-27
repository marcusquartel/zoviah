import type { ProgramStatus } from "@/types/database";

export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  draft: "Rascunho",
  active: "Ativo",
  paused: "Pausado",
  archived: "Arquivado",
};

export const PROGRAM_STATUS_VARIANTS: Record<
  ProgramStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  active: "default",
  paused: "secondary",
  archived: "outline",
};

export const PROGRAM_STATUS_ORDER: ProgramStatus[] = [
  "draft",
  "active",
  "paused",
  "archived",
];
