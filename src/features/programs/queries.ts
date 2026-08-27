import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrganization } from "@/features/organizations/queries";
import type { FormField, Program, ProgramStatus } from "@/types/database";

export interface ProgramListItem {
  id: string;
  name: string;
  slug: string;
  status: ProgramStatus;
  created_at: string;
  application_count: number;
}

/** Programs of the current organization, newest first, with a submission count. */
export const listPrograms = cache(async (): Promise<ProgramListItem[]> => {
  const current = await getCurrentOrganization();
  if (!current) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .select("id, name, slug, status, created_at, applications(count)")
    .eq("organization_id", current.organization.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    status: p.status,
    created_at: p.created_at,
    application_count: p.applications[0]?.count ?? 0,
  }));
});

/** A single program in the current org (RLS + explicit org filter). */
export const getProgram = cache(
  async (programId: string): Promise<Program | null> => {
    const current = await getCurrentOrganization();
    if (!current) return null;

    const supabase = await createClient();
    const { data } = await supabase
      .from("programs")
      .select("*")
      .eq("organization_id", current.organization.id)
      .eq("id", programId)
      .maybeSingle();

    return data ?? null;
  },
);

export const getFormFields = cache(
  async (programId: string): Promise<FormField[]> => {
    const current = await getCurrentOrganization();
    if (!current) return [];

    const supabase = await createClient();
    const { data } = await supabase
      .from("form_fields")
      .select("*")
      .eq("organization_id", current.organization.id)
      .eq("program_id", programId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    return data ?? [];
  },
);

export interface ApplicationRow {
  id: string;
  submitted_at: string;
  possible_duplicate: boolean;
  form_version: number;
  creator_name: string;
  creator_email: string | null;
}

export async function listApplications(
  programId: string,
  limit = 50,
): Promise<{ rows: ApplicationRow[]; total: number }> {
  const current = await getCurrentOrganization();
  if (!current) return { rows: [], total: 0 };

  const supabase = await createClient();

  const { count } = await supabase
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", current.organization.id)
    .eq("program_id", programId);

  const { data } = await supabase
    .from("applications")
    .select(
      "id, submitted_at, possible_duplicate, form_version, creators(full_name, email)",
    )
    .eq("organization_id", current.organization.id)
    .eq("program_id", programId)
    .order("submitted_at", { ascending: false })
    .limit(limit);

  const rows: ApplicationRow[] = (data ?? []).map((a) => ({
    id: a.id,
    submitted_at: a.submitted_at,
    possible_duplicate: a.possible_duplicate,
    form_version: a.form_version,
    creator_name: a.creators?.full_name ?? "—",
    creator_email: a.creators?.email ?? null,
  }));

  return { rows, total: count ?? 0 };
}
