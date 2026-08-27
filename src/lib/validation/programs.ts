import { z } from "zod";
import { FIELD_KEY_RE, SLUG_RE } from "@/lib/slug";
import { FIELD_TYPES } from "@/lib/form-fields";
import type { FieldType } from "@/types/database";

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().default("");

export const programGeneralSchema = z.object({
  name: z.string().trim().min(1, { error: "Informe o nome." }).max(120),
  slug: z
    .string()
    .trim()
    .min(1, { error: "Informe o slug." })
    .max(80)
    .regex(SLUG_RE, { error: "Use apenas letras minúsculas, números e hífens." }),
  description: optionalText(2000),
  public_title: optionalText(160),
  public_description: optionalText(4000),
  success_message: optionalText(2000),
  status: z.enum(["draft", "active", "paused", "archived"]),
});

export type ProgramGeneralInput = z.infer<typeof programGeneralSchema>;

const fieldType = z.enum(FIELD_TYPES as [FieldType, ...FieldType[]]);

export const addFieldSchema = z.object({
  label: z.string().trim().min(1, { error: "Informe o rótulo." }).max(160),
  field_type: fieldType,
});

export const fieldOptionSchema = z.object({
  value: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9_-]*$/, { error: "Valor inválido para a opção." }),
  label: z.string().trim().min(1).max(160),
});

export const updateFieldSchema = z.object({
  field_key: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(FIELD_KEY_RE, {
      error: "A chave deve começar com letra e conter só letras, números e _.",
    }),
  label: z.string().trim().min(1, { error: "Informe o rótulo." }).max(160),
  field_type: fieldType,
  placeholder: z.string().trim().max(160).optional().default(""),
  help_text: z.string().trim().max(400).optional().default(""),
  required: z.boolean(),
  mapping: z
    .enum([
      "full_name",
      "preferred_name",
      "birth_date",
      "email",
      "phone",
      "city",
      "state",
      "postal_code",
      "instagram",
      "instagram_followers",
      "tiktok",
      "tiktok_followers",
    ])
    .optional(),
  options: z.array(fieldOptionSchema).max(50).default([]),
});

export type UpdateFieldInput = z.infer<typeof updateFieldSchema>;
