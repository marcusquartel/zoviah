import { z } from "zod";
// Relative (not "@/") so this module stays importable by the node test runner.
import { parseCount } from "./normalize.ts";
import { BR_UFS } from "./br-locations.ts";
import type { FieldMapping, FieldOption, FieldType } from "@/types/database";

/** All field types the MVP form builder supports. */
export const FIELD_TYPES: readonly FieldType[] = [
  "text",
  "textarea",
  "email",
  "phone",
  "number",
  "url",
  "date",
  "single_select",
  "multi_select",
  "checkbox",
  "instagram",
  "tiktok",
  "br_state",
  "br_city",
] as const;

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  email: "E-mail",
  phone: "Telefone / WhatsApp",
  number: "Número",
  url: "Link (URL)",
  date: "Data",
  single_select: "Seleção única",
  multi_select: "Seleção múltipla",
  checkbox: "Confirmação (checkbox)",
  instagram: "Instagram (@handle)",
  tiktok: "TikTok (@handle)",
  br_state: "Estado (BR)",
  br_city: "Cidade (BR)",
};

/** Field types whose options / value list are fixed by the platform. */
export const BR_LOCATION_TYPES: readonly FieldType[] = ["br_state", "br_city"];

export const SELECT_TYPES: readonly FieldType[] = [
  "single_select",
  "multi_select",
];

/** Structured columns a field's answer can feed. `configuration.mapping`. */
export const FIELD_MAPPING_LABELS: Record<FieldMapping, string> = {
  full_name: "Nome completo → creators.full_name",
  preferred_name: "Nome preferido → creators.preferred_name",
  birth_date: "Data de nascimento → creators.birth_date",
  email: "E-mail → creators.email",
  phone: "Telefone → creators.phone_e164",
  city: "Cidade → creators.city",
  state: "Estado → creators.state",
  postal_code: "CEP → creators.postal_code",
  instagram: "Instagram → creator_social_profiles",
  instagram_followers: "Seguidores Instagram → social profile",
  tiktok: "TikTok → creator_social_profiles",
  tiktok_followers: "Seguidores TikTok → social profile",
};

/** Which mappings make sense for a given field type (empty = free field). */
export function mappingsForFieldType(type: FieldType): FieldMapping[] {
  switch (type) {
    case "text":
      return ["full_name", "preferred_name", "city", "state", "postal_code"];
    case "email":
      return ["email"];
    case "phone":
      return ["phone"];
    case "date":
      return ["birth_date"];
    case "number":
      return ["instagram_followers", "tiktok_followers", "postal_code"];
    case "instagram":
      return ["instagram"];
    case "tiktok":
      return ["tiktok"];
    case "br_state":
      return ["state"];
    case "br_city":
      return ["city"];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Shared shape of a field as seen by the public form + validators.
// ---------------------------------------------------------------------------
export interface PublicFieldDef {
  field_key: string;
  label: string;
  field_type: FieldType;
  placeholder: string | null;
  help_text: string | null;
  required: boolean;
  options: FieldOption[] | null;
  configuration: { mapping?: FieldMapping } | null;
  position: number;
}

const CONSENT_KEY = "_consent";
const HONEYPOT_KEY = "_hp";

export const CONSENT_FIELD_KEY = CONSENT_KEY;
export const HONEYPOT_FIELD_KEY = HONEYPOT_KEY;

/**
 * Whether a field should render as a Brazil location picker — a UF `<select>`
 * for "state", a municipality combobox for "city". True for the dedicated
 * `br_state` / `br_city` types AND for any field mapped to `state` / `city`
 * (so forms built before those types still get the controlled list, never
 * free text).
 */
export function brLocationKind(
  field: Pick<PublicFieldDef, "field_type" | "configuration">,
): "state" | "city" | null {
  const mapping = field.configuration?.mapping;
  if (field.field_type === "br_state" || mapping === "state") return "state";
  if (field.field_type === "br_city" || mapping === "city") return "city";
  return null;
}

/**
 * The stored `field_type` for a field, coerced so a state/city mapping always
 * lands on the controlled `br_state` / `br_city` type. Used when creating or
 * editing a field so the builder and the public form agree.
 */
export function coerceFieldType(
  type: FieldType,
  mapping: FieldMapping | undefined,
): FieldType {
  if (mapping === "state") return "br_state";
  if (mapping === "city") return "br_city";
  return type;
}

/** Default RHF value for a field (also the "empty" answer). */
export function defaultAnswerFor(field: PublicFieldDef): unknown {
  if (field.field_type === "multi_select") return [];
  if (field.field_type === "checkbox") return false;
  return "";
}

export function defaultFormValues(
  fields: PublicFieldDef[],
): Record<string, unknown> {
  const values: Record<string, unknown> = {
    [CONSENT_KEY]: false,
    [HONEYPOT_KEY]: "",
  };
  for (const f of fields) values[f.field_key] = defaultAnswerFor(f);
  return values;
}

// ---------------------------------------------------------------------------
// Zod schema built from field defs. The client runs `safeParse` for UX; the
// server re-runs the same builder as the real gate.
// ---------------------------------------------------------------------------
function schemaForField(field: PublicFieldDef): z.ZodTypeAny {
  const req = field.required;
  const optionValues = (field.options ?? []).map((o) => o.value);

  // A state/city field validates as a UF / municipality name regardless of its
  // stored `field_type` (see brLocationKind).
  const loc = brLocationKind(field);
  if (loc === "state") {
    return z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => (req ? v !== "" : true), { error: "Selecione o estado." })
      .refine((v) => v === "" || (BR_UFS as readonly string[]).includes(v), {
        error: "Estado inválido.",
      });
  }
  if (loc === "city") {
    const base = z.string().trim().max(120, { error: "Cidade muito longa." });
    return req ? base.min(1, { error: "Selecione a cidade." }) : base;
  }

  switch (field.field_type) {
    case "textarea":
    case "text":
    case "phone":
    case "instagram":
    case "tiktok": {
      // Cap mirrors the per-answer limit enforced in submit_application (SEC-003).
      const base = z
        .string()
        .trim()
        .max(5000, { error: "Resposta muito longa." });
      return req ? base.min(1, { error: "Campo obrigatório." }) : base;
    }
    case "email": {
      if (req) {
        return z
          .string()
          .trim()
          .pipe(z.email({ error: "Informe um e-mail válido." }));
      }
      return z
        .string()
        .trim()
        .refine((v) => v === "" || z.email().safeParse(v).success, {
          error: "Informe um e-mail válido.",
        });
    }
    case "url": {
      return z
        .string()
        .trim()
        .refine((v) => (req ? v !== "" : true), { error: "Campo obrigatório." })
        .refine((v) => v === "" || z.url().safeParse(v).success, {
          error: "Informe um link válido.",
        });
    }
    case "number": {
      return z
        .string()
        .trim()
        .refine((v) => (req ? v !== "" : true), { error: "Campo obrigatório." })
        .refine((v) => v === "" || parseCount(v) != null || !Number.isNaN(Number(v)), {
          error: "Informe um número.",
        });
    }
    case "date": {
      return z
        .string()
        .trim()
        .refine((v) => (req ? v !== "" : true), { error: "Campo obrigatório." })
        .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), {
          error: "Data inválida.",
        });
    }
    // br_state / br_city are handled by the brLocationKind() check above.
    case "single_select": {
      return z
        .string()
        .refine((v) => (req ? v !== "" : true), { error: "Campo obrigatório." })
        .refine((v) => v === "" || optionValues.includes(v), {
          error: "Opção inválida.",
        });
    }
    case "multi_select": {
      const base = z
        .array(z.string())
        .refine((arr) => arr.every((v) => optionValues.includes(v)), {
          error: "Opção inválida.",
        });
      return req
        ? base.min(1, { error: "Selecione ao menos uma opção." })
        : base;
    }
    case "checkbox": {
      return req
        ? z.literal(true, { error: "Confirmação obrigatória." })
        : z.boolean();
    }
    default:
      return z.string();
  }
}

export interface BuildSchemaOptions {
  /** Require the consent checkbox (public form). Default true. */
  consent?: boolean;
}

export function buildFieldSchema(
  fields: PublicFieldDef[],
  options: BuildSchemaOptions = {},
): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of fields) {
    shape[field.field_key] = schemaForField(field);
  }
  shape[HONEYPOT_KEY] = z
    .string()
    .max(0, { error: "spam" })
    .optional()
    .default("");
  if (options.consent !== false) {
    shape[CONSENT_KEY] = z.literal(true, {
      error: "É necessário autorizar o uso das informações.",
    });
  }
  return z.object(shape) as z.ZodType<Record<string, unknown>>;
}
