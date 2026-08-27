/** `^[a-z0-9]+(-[a-z0-9]+)*$` — matches the DB check on programs.slug. */
export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `^[a-z][a-z0-9_]*$` — matches the DB check on form_fields.field_key. */
export const FIELD_KEY_RE = /^[a-z][a-z0-9_]*$/;

const COMBINING_MARKS = /[\u0300-\u036f]/g;

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(COMBINING_MARKS, "");
}

/** "Rare Creators!" -> "rare-creators" */
export function slugify(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "Seguidores no Instagram" -> "seguidores_no_instagram" */
export function fieldKeyify(value: string): string {
  const key = stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^([0-9])/, "f_$1");
  return key || "field";
}

export function isValidSlug(value: string): boolean {
  return SLUG_RE.test(value);
}

export function isValidFieldKey(value: string): boolean {
  return FIELD_KEY_RE.test(value);
}
