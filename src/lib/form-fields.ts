import { z } from "zod";
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
};

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

  switch (field.field_type) {
    case "textarea":
    case "text":
    case "phone":
    case "instagram":
    case "tiktok": {
      const base = z.string().trim();
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
        .refine((v) => v === "" || !Number.isNaN(Number(v)), {
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
