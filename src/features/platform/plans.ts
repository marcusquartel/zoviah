import type {
  OrgInviteStatus,
  OrganizationStatus,
  PlanCode,
} from "@/types/database";

/**
 * Commercial condition codes. Prices are a business decision, NOT schema —
 * the code only records which condition an organization is on.
 */
export const PLAN_CODES: readonly PlanCode[] = [
  "founding",
  "starter",
  "pro",
  "agency",
  "enterprise",
] as const;

export const PLAN_LABELS: Record<PlanCode, string> = {
  founding: "Founding",
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
  enterprise: "Enterprise",
};

/** Operational gate — no billing states (past_due / grace_period) yet. */
export const ORG_STATUS_LABELS: Record<OrganizationStatus, string> = {
  active: "Ativa",
  inactive: "Inativa",
  suspended: "Suspensa",
};

export const INVITE_STATUS_LABELS: Record<OrgInviteStatus, string> = {
  pending: "Pendente",
  accepted: "Aceito",
  expired: "Expirado",
  revoked: "Revogado",
};

/** Central TTL for team invites (mirrored in create_org_invite). */
export const ORG_INVITE_TTL_DAYS = 14;

export function isPlanCode(v: string): v is PlanCode {
  return (PLAN_CODES as readonly string[]).includes(v);
}
