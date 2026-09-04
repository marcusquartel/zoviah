// Shared by every path that turns validated form answers into the shape
// `submit_application` expects — the public form, manual creator entry, and
// spreadsheet import all call this, so the mapping stays in one place.
import {
  normalizeEmail,
  normalizeHandle,
  normalizePhoneBR,
  parseCount,
  socialProfileUrl,
} from "@/lib/normalize";
import { BR_UFS } from "@/lib/br-locations";
import type { PublicFieldDef } from "@/lib/form-fields";
import type { FieldMapping } from "@/types/database";

export type SocialDraft = {
  platform: "instagram" | "tiktok";
  handle: string;
  handle_normalized: string;
  profile_url: string | null;
  followers_declared?: number | null;
};

export interface ApplicationPayload {
  answersClean: Record<string, unknown>;
  creator: Record<string, string | null>;
  socials: SocialDraft[];
  fieldSnapshot: { field_key: string; label: string; field_type: string }[];
}

/** Turns Zod-validated `{field_key: value}` answers into RPC-ready pieces. */
export function buildApplicationPayload(
  fields: PublicFieldDef[],
  values: Record<string, unknown>,
): ApplicationPayload {
  const answersClean: Record<string, unknown> = {};
  const creator: Record<string, string | null> = {};
  const socials: Partial<Record<"instagram" | "tiktok", SocialDraft>> = {};
  const followers: Partial<Record<"instagram" | "tiktok", number>> = {};

  const ensureSocial = (platform: "instagram" | "tiktok", raw: unknown): void => {
    const normalized = normalizeHandle(raw, platform);
    if (!normalized) return;
    socials[platform] = {
      platform,
      handle: String(raw).trim(),
      handle_normalized: normalized,
      profile_url: socialProfileUrl(platform, normalized),
    };
  };

  const setCreator = (key: string, raw: unknown): void => {
    const s = typeof raw === "string" ? raw.trim() : "";
    if (s) creator[key] = s;
  };

  for (const field of fields) {
    const value = values[field.field_key];
    answersClean[field.field_key] = value;
    const mapping: FieldMapping | undefined = field.configuration?.mapping;

    if (field.field_type === "instagram" || mapping === "instagram") {
      ensureSocial("instagram", value);
    } else if (field.field_type === "tiktok" || mapping === "tiktok") {
      ensureSocial("tiktok", value);
    } else if (field.field_type === "br_state" || mapping === "state") {
      const uf = typeof value === "string" ? value.trim().toUpperCase() : "";
      if ((BR_UFS as readonly string[]).includes(uf)) creator.state = uf;
    } else if (field.field_type === "br_city" || mapping === "city") {
      setCreator("city", value);
    } else if (mapping === "instagram_followers") {
      const n = parseCount(value);
      if (n != null) followers.instagram = n;
    } else if (mapping === "tiktok_followers") {
      const n = parseCount(value);
      if (n != null) followers.tiktok = n;
    } else if (mapping === "email") {
      creator.email = normalizeEmail(value);
    } else if (mapping === "phone") {
      creator.phone_e164 = normalizePhoneBR(value);
    } else if (mapping === "full_name") {
      setCreator("full_name", value);
    } else if (mapping === "preferred_name") {
      setCreator("preferred_name", value);
    } else if (mapping === "birth_date") {
      setCreator("birth_date", value);
    } else if (mapping === "postal_code") {
      setCreator("postal_code", value);
    }
  }

  for (const platform of ["instagram", "tiktok"] as const) {
    if (socials[platform] && followers[platform] != null) {
      socials[platform]!.followers_declared = followers[platform];
    }
  }

  const fieldSnapshot = fields.map((f) => ({
    field_key: f.field_key,
    label: f.label,
    field_type: f.field_type,
  }));

  return { answersClean, creator, socials: Object.values(socials), fieldSnapshot };
}
