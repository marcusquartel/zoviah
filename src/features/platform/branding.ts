/** Brand-image upload constraints. Pure so it can be unit-tested and reused. */

export const LOGO_MAX_BYTES = 1_048_576; // 1 MiB
export const LOGO_MIME_TYPES = ["image/png", "image/jpeg"] as const;

export interface LogoFileMeta {
  type: string;
  size: number;
}

export type LogoCheck =
  | { ok: true; ext: "png" | "jpg" }
  | { ok: false; error: string };

/** Validate a candidate logo file (type + size). */
export function checkLogoFile(file: LogoFileMeta): LogoCheck {
  if (!(LOGO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "Envie um arquivo PNG ou JPG." };
  }
  if (file.size <= 0) {
    return { ok: false, error: "Arquivo vazio." };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, error: "O arquivo passa de 1 MB." };
  }
  return { ok: true, ext: file.type === "image/png" ? "png" : "jpg" };
}
