import { createClient } from "@/lib/supabase/server";
import type { CreatorTier } from "@/types/database";

export interface TierWithCount extends CreatorTier {
  creators: number;
}

/** The organization's tiers, in display order, with how many creators each has. */
export async function getTiers(orgId: string): Promise<TierWithCount[]> {
  const supabase = await createClient();
  const [{ data: tiers }, { data: members }] = await Promise.all([
    supabase
      .from("creator_tiers")
      .select("*")
      .eq("organization_id", orgId)
      .order("position")
      .order("name"),
    supabase
      .from("creators")
      .select("tier_id")
      .eq("organization_id", orgId)
      .is("archived_at", null)
      .not("tier_id", "is", null),
  ]);
  const counts = new Map<string, number>();
  for (const m of members ?? []) {
    if (m.tier_id) counts.set(m.tier_id, (counts.get(m.tier_id) ?? 0) + 1);
  }
  return ((tiers ?? []) as CreatorTier[]).map((t) => ({
    ...t,
    commission_rate: Number(t.commission_rate),
    creators: counts.get(t.id) ?? 0,
  }));
}
