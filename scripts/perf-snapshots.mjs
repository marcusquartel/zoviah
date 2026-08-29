/**
 * FASE 3B — Evidence Layer rough performance check against the real database.
 *
 *   node scripts/perf-snapshots.mjs [count]     # default 1000
 *
 * Creates a THROWAWAY tenant with ONE creator + ONE social profile, seeds
 * `count` metric snapshots on that profile, then times the two queries the
 * Métricas tab actually runs: the latest-snapshot lookup
 * (`latest_metric_snapshots`) and one page of that profile's history. Deletes
 * everything it created. Never touches existing tenants (§83, §85).
 * Do not run against production.
 */
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !serviceKey || !anonKey) {
  console.error("Missing Supabase env in .env.local");
  process.exit(1);
}

const COUNT = Number.parseInt(process.argv[2] ?? "1000", 10);
const stamp = Date.now();
const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function time(label, fn) {
  const runs = [];
  for (let i = 0; i < 5; i += 1) {
    const t = performance.now();
    const { error, count } = await fn();
    if (error) throw new Error(`${label}: ${error.message}`);
    runs.push(performance.now() - t);
    if (i === 0 && count != null) console.log(`  (${count} rows match)`);
  }
  runs.sort((a, b) => a - b);
  console.log(
    `  ${label}: median ${runs[2].toFixed(0)}ms  (min ${runs[0].toFixed(0)}  max ${runs[4].toFixed(0)})`,
  );
}

async function main() {
  console.log(`Seeding a throwaway tenant with ${COUNT} metric snapshots…`);

  const user = await admin.auth.admin.createUser({
    email: `perfsnap-${stamp}@example.test`,
    password: `Pp1!${stamp}xyz`,
    email_confirm: true,
  });
  const userId = user.data.user.id;

  const org = await admin
    .from("organizations")
    .insert({ name: "Perf Snap", slug: `perfsnap-${stamp}` })
    .select("id")
    .single();
  const orgId = org.data.id;

  await admin
    .from("organization_members")
    .insert({ organization_id: orgId, user_id: userId, role: "owner" });

  const creator = await admin
    .from("creators")
    .insert({ organization_id: orgId, full_name: "Perf Snap Creator" })
    .select("id")
    .single();
  const creatorId = creator.data.id;

  const profile = await admin
    .from("creator_social_profiles")
    .insert({
      organization_id: orgId,
      creator_id: creatorId,
      platform: "instagram",
      handle: `perfsnap_${stamp}`,
      handle_normalized: `perfsnap_${stamp}`,
      followers_declared: 50000,
    })
    .select("id")
    .single();
  const profileId = profile.data.id;

  const base = Date.now();
  for (let start = 0; start < COUNT; start += 500) {
    const n = Math.min(500, COUNT - start);
    const rows = Array.from({ length: n }, (_, k) => {
      const i = start + k;
      return {
        organization_id: orgId,
        creator_id: creatorId,
        social_profile_id: profileId,
        source: i % 2 === 0 ? "admin_manual" : "creator_provided",
        // one observation per day going back in time
        observed_at: new Date(base - i * 86_400_000).toISOString(),
        period_days: 30,
        followers: 50000 + i * 10,
        median_views: 4000 + (i % 2000),
        average_views: 4200 + (i % 2000),
        views_sample: [3800 + (i % 500), 4000 + (i % 700), 6000 + (i % 900)],
        posts_count: 8 + (i % 6),
        reach: 9000 + (i % 3000),
      };
    });
    const ins = await admin.from("social_metric_snapshots").insert(rows);
    if (ins.error) throw ins.error;
    process.stdout.write(`\r  ${start + n}/${COUNT}`);
  }
  console.log("");

  const member = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await member.auth.signInWithPassword({
    email: `perfsnap-${stamp}@example.test`,
    password: `Pp1!${stamp}xyz`,
  });

  console.log("\nMétricas tab queries (as an authenticated member, RLS on):");
  await time("latest snapshot for the profile (view)", () =>
    member
      .from("latest_metric_snapshots")
      .select("*")
      .eq("social_profile_id", profileId)
      .maybeSingle(),
  );
  await time("latest snapshot direct (order + limit 1)", () =>
    member
      .from("social_metric_snapshots")
      .select("*")
      .eq("organization_id", orgId)
      .eq("social_profile_id", profileId)
      .order("observed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
  await time("history page 1 (11 rows)", () =>
    member
      .from("social_metric_snapshots")
      .select("*", { count: "exact" })
      .eq("organization_id", orgId)
      .eq("social_profile_id", profileId)
      .order("observed_at", { ascending: false })
      .order("created_at", { ascending: false })
      .range(0, 10),
  );
  await time("evidence_stats RPC", () => member.rpc("evidence_stats", {}));

  console.log(
    "\nNote: both reads hit the (social_profile_id, observed_at desc, created_at desc) index.",
  );

  console.log("\nCleaning up…");
  await admin.from("social_metric_snapshots").delete().eq("organization_id", orgId);
  await admin.from("creator_social_profiles").delete().eq("organization_id", orgId);
  await admin.from("creators").delete().eq("organization_id", orgId);
  await admin.from("organizations").delete().eq("id", orgId);
  await admin.auth.admin.deleteUser(userId);
  console.log("Done.");
}

main().catch((err) => {
  console.error("\nperf-snapshots failed:", err.message);
  console.error(`You may need to clean up an org with slug perfsnap-${stamp}`);
  process.exit(1);
});
