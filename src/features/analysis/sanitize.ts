/**
 * Turns an application + its creator into the SANITIZED evidence used by both
 * the deterministic layer and the model. PURE.
 *
 * Privacy (§27): the model NEVER receives name, e-mail, phone, birth date,
 * postal code, address, internal IDs, timeline or notes. Anything with a PII
 * mapping / type / label is dropped here. Large free-text is truncated.
 */
import { isPlausibleHandle } from "../../lib/normalize.ts";
import { deriveSnapshotMetrics } from "../evidence/metrics.ts";
import type {
  Application,
  Creator,
  CreatorSocialProfile,
  FieldMapping,
  FormField,
  Program,
  SocialMetricSnapshot,
} from "@/types/database";

export const MAX_FIELD_CHARS = 800;
export const MAX_ARRAY_ITEMS = 20;
export const MAX_RELEVANT_ANSWERS = 25;
export const MAX_PURPOSE_CHARS = 600;

const PII_MAPPINGS: ReadonlySet<FieldMapping> = new Set<FieldMapping>([
  "full_name",
  "preferred_name",
  "birth_date",
  "email",
  "phone",
  "postal_code",
]);
const PII_FIELD_TYPES = new Set(["email", "phone", "date"]);
const PII_LABEL_RE =
  /(e-?mail|telefone|whatsapp|celular|nascimento|idade|cep|endere|bairro|rua|cpf|rg\b|documento)/i;

const TOPIC_LABEL_RE = /(assunto|tema|nicho|conte[úu]d|categoria)/i;
const PARTNERSHIP_LABEL_RE =
  /(marca|parceria|m[ íi]dia ?kit|media ?kit|colabora|publi)/i;
const LINK_LABEL_RE = /(link|url|portf[óo]lio)/i;

export interface PlatformSnapshots {
  latest: SocialMetricSnapshot;
  previous: SocialMetricSnapshot | null;
}

export interface AnalysisInput {
  program: Pick<
    Program,
    "name" | "description" | "public_description"
  >;
  creator: Creator;
  socials: CreatorSocialProfile[];
  application: Pick<Application, "answers" | "field_snapshot">;
  formFields: Pick<FormField, "field_key" | "field_type" | "configuration">[];
  /** Latest (+ previous, for growth) metric snapshot per platform (§45). */
  snapshots?: Partial<Record<"instagram" | "tiktok", PlatformSnapshots>>;
}

/** Metric evidence for the model — derived numbers only, no handle/id/name. */
export interface SocialMetricEvidence {
  followers: number | null;
  median_views: number | null;
  average_views: number | null;
  median_view_rate: number | null;
  sample_size: number;
  posts_per_week: number | null;
  engagement_by_followers: number | null;
  engagement_by_reach: number | null;
  reach: number | null;
  interactions: number | null;
  follower_growth_rate: number | null;
  growth_period_days: number | null;
  snapshot_age_days: number;
  source: string;
}

export interface SanitizedEvidence {
  program: { name: string; purpose: string | null };
  contentTopics: string[];
  partnershipInfo: Record<string, string>;
  relevantAnswers: Record<string, string | string[]>;
  declaredMetrics: {
    instagram_followers: number | null;
    instagram_avg_views: number | null;
    tiktok_followers: number | null;
    tiktok_avg_views: number | null;
  };
  contentLinks: string[];
  registration: {
    hasName: boolean;
    hasEmail: boolean;
    hasPhone: boolean;
    hasCity: boolean;
    hasState: boolean;
  };
  socialHandles: { platform: string; handle: string; plausible: boolean }[];
  /** Derived, PII-free metric evidence keyed by platform (§45). */
  socialMetrics: Partial<Record<"instagram" | "tiktok", SocialMetricEvidence>>;
}

const round3 = (n: number | null): number | null =>
  n == null ? null : Math.round(n * 1000) / 1000;
const roundInt = (n: number | null): number | null =>
  n == null ? null : Math.round(n);

function toMetricEvidence(snaps: PlatformSnapshots): SocialMetricEvidence {
  const d = deriveSnapshotMetrics(snaps.latest, snaps.previous);
  return {
    followers: d.followers,
    median_views: d.medianViews,
    average_views: d.averageViews,
    median_view_rate: round3(d.medianViewRate),
    sample_size: d.sampleSize,
    posts_per_week: round3(d.postsPerWeek),
    engagement_by_followers: round3(d.engagementByFollowers),
    engagement_by_reach: round3(d.engagementByReach),
    reach: d.reach,
    interactions: roundInt(d.interactions),
    follower_growth_rate: round3(d.followerGrowthRate),
    growth_period_days: d.growthPeriodDays,
    snapshot_age_days: d.snapshotAgeDays,
    source: d.source,
  };
}

function truncate(value: string): string {
  return value.length > MAX_FIELD_CHARS
    ? `${value.slice(0, MAX_FIELD_CHARS)}…`
    : value;
}

function asText(value: unknown): string | string[] | null {
  if (value == null) return null;
  if (Array.isArray(value)) {
    const items = value
      .map((v) => String(v).trim())
      .filter(Boolean)
      .slice(0, MAX_ARRAY_ITEMS);
    return items.length ? items : null;
  }
  if (typeof value === "boolean") return value ? "sim" : "não";
  const s = String(value).trim();
  return s ? truncate(s) : null;
}

export function sanitizeEvidence(input: AnalysisInput): SanitizedEvidence {
  const { creator, socials, application } = input;
  const answers = application.answers ?? {};
  const snapshot = application.field_snapshot ?? [];
  const configByKey = new Map(
    input.formFields.map((f) => [f.field_key, f.configuration]),
  );

  const relevantAnswers: Record<string, string | string[]> = {};
  const partnershipInfo: Record<string, string> = {};
  const contentTopics: string[] = [];
  const contentLinks: string[] = [];

  for (const field of snapshot) {
    const mapping = configByKey.get(field.field_key)?.mapping;
    const raw = answers[field.field_key];
    const value = asText(raw);
    if (value == null) continue;

    const isPii =
      (mapping && PII_MAPPINGS.has(mapping)) ||
      PII_FIELD_TYPES.has(field.field_type) ||
      PII_LABEL_RE.test(field.label);
    if (isPii) continue;

    // Social handles are covered by declaredMetrics (counts only) and never go
    // into the payload — a handle can carry a real name (§19, §27). Skip them.
    if (
      field.field_type === "instagram" ||
      field.field_type === "tiktok" ||
      mapping === "instagram" ||
      mapping === "tiktok"
    ) {
      continue;
    }

    if (
      (field.field_type === "url" || LINK_LABEL_RE.test(field.label)) &&
      typeof value === "string"
    ) {
      contentLinks.push(value);
      continue;
    }

    if (TOPIC_LABEL_RE.test(field.label)) {
      const parts = Array.isArray(value)
        ? value
        : String(value)
            .split(/[,;/]|\se\s/)
            .map((s) => s.trim())
            .filter(Boolean);
      contentTopics.push(...parts.slice(0, MAX_ARRAY_ITEMS));
      continue;
    }

    if (PARTNERSHIP_LABEL_RE.test(field.label)) {
      partnershipInfo[field.label] = Array.isArray(value)
        ? value.join(", ")
        : value;
      continue;
    }

    if (Object.keys(relevantAnswers).length < MAX_RELEVANT_ANSWERS) {
      relevantAnswers[field.label] = value;
    }
  }

  const ig = topSocial(socials, "instagram");
  const tt = topSocial(socials, "tiktok");

  const socialMetrics: SanitizedEvidence["socialMetrics"] = {};
  if (input.snapshots?.instagram) {
    socialMetrics.instagram = toMetricEvidence(input.snapshots.instagram);
  }
  if (input.snapshots?.tiktok) {
    socialMetrics.tiktok = toMetricEvidence(input.snapshots.tiktok);
  }

  const purposeRaw = (
    input.program.public_description ??
    input.program.description ??
    ""
  ).trim();

  return {
    program: {
      name: input.program.name,
      purpose: purposeRaw
        ? purposeRaw.slice(0, MAX_PURPOSE_CHARS)
        : null,
    },
    contentTopics: dedupe(contentTopics),
    partnershipInfo,
    relevantAnswers,
    declaredMetrics: {
      instagram_followers: ig?.followers_declared ?? null,
      instagram_avg_views: ig?.average_views_declared ?? null,
      tiktok_followers: tt?.followers_declared ?? null,
      tiktok_avg_views: tt?.average_views_declared ?? null,
    },
    contentLinks,
    registration: {
      hasName: Boolean(creator.full_name?.trim()),
      hasEmail: Boolean(creator.email?.trim()),
      hasPhone: Boolean(creator.phone_e164?.trim()),
      hasCity: Boolean(creator.city?.trim()),
      hasState: Boolean(creator.state?.trim()),
    },
    socialHandles: socials.map((s) => ({
      platform: s.platform,
      handle: s.handle_normalized,
      plausible:
        s.platform === "instagram" || s.platform === "tiktok"
          ? isPlausibleHandle(s.handle_normalized, s.platform)
          : true,
    })),
    socialMetrics,
  };
}

function topSocial(
  socials: CreatorSocialProfile[],
  platform: string,
): CreatorSocialProfile | undefined {
  return socials
    .filter((s) => s.platform === platform)
    .sort(
      (a, b) => (b.followers_declared ?? 0) - (a.followers_declared ?? 0),
    )[0];
}

function dedupe(list: string[]): string[] {
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))].slice(
    0,
    MAX_ARRAY_ITEMS,
  );
}

// ---------------------------------------------------------------------------
// The exact JSON payload sent to the model (and stored as input_snapshot).
// No PII, no API key, bounded size.
// ---------------------------------------------------------------------------
export interface ClaudePayload {
  program: { name: string; purpose: string | null };
  creator_evidence: {
    content_topics: string[];
    declared_metrics: SanitizedEvidence["declaredMetrics"];
    partnership_information: Record<string, string>;
    relevant_answers: Record<string, string | string[]>;
  };
  objective_metrics: {
    registration_completeness: number;
    social_profiles_count: number;
    content_links_provided: number;
    /** Observed metric evidence (§45). Absent when there are no snapshots. */
    social?: Partial<Record<"instagram" | "tiktok", SocialMetricEvidence>>;
  };
}

export function buildClaudePayload(ev: SanitizedEvidence): ClaudePayload {
  const reg = ev.registration;
  const regScore =
    [
      reg.hasName,
      reg.hasEmail || reg.hasPhone,
      reg.hasCity,
      reg.hasState,
    ].filter(Boolean).length / 4;

  const hasMetrics = Object.keys(ev.socialMetrics).length > 0;
  const payload: ClaudePayload = {
    program: ev.program,
    creator_evidence: {
      content_topics: ev.contentTopics,
      declared_metrics: ev.declaredMetrics,
      partnership_information: ev.partnershipInfo,
      relevant_answers: ev.relevantAnswers,
    },
    objective_metrics: {
      registration_completeness: Math.round(regScore * 100) / 100,
      social_profiles_count: ev.socialHandles.length,
      content_links_provided: ev.contentLinks.length,
      ...(hasMetrics ? { social: ev.socialMetrics } : {}),
    },
  };

  // Hard size cap (§36): drop relevant_answers first if the payload is huge.
  let json = JSON.stringify(payload);
  if (json.length > 12000) {
    payload.creator_evidence.relevant_answers = Object.fromEntries(
      Object.entries(payload.creator_evidence.relevant_answers).slice(0, 8),
    );
    json = JSON.stringify(payload);
  }
  return payload;
}
