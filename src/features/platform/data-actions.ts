"use server";

import {
  getOrganizationDetail,
  listOrganizations,
  listPlatformAudit,
  type AdminOrgDetail,
} from "@/features/platform/queries";

export async function loadOrganizations(search: string, page: number) {
  return listOrganizations(search, page);
}

export async function loadOrganizationDetail(
  id: string,
): Promise<AdminOrgDetail | null> {
  return getOrganizationDetail(id);
}

export async function loadPlatformAudit(page: number) {
  return listPlatformAudit(page);
}
