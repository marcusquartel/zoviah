import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { PublicFieldDef } from "@/lib/form-fields";
import type { ProgramStatus } from "@/types/database";

export interface PublicProgramData {
  organization: {
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
  };
  program: {
    slug: string;
    status: ProgramStatus;
    form_version: number;
    public_title: string;
    public_description: string | null;
    success_message: string | null;
  };
  fields: PublicFieldDef[];
}

/**
 * Public landing data via the `get_public_program` SECURITY DEFINER RPC — the
 * only thing an unauthenticated visitor can read. Returns null for a missing
 * program or one in draft/archived.
 */
export const getPublicProgram = cache(
  async (
    orgSlug: string,
    programSlug: string,
  ): Promise<PublicProgramData | null> => {
    if (!isSupabaseConfigured()) return null;

    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_public_program", {
      p_org_slug: orgSlug,
      p_program_slug: programSlug,
    });

    if (error || !data) return null;
    return data as unknown as PublicProgramData;
  },
);
