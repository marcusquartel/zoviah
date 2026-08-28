/**
 * Phase 2 CRM list — rough performance check against the real database.
 *
 *   node scripts/perf-check.mjs [count]        # default 1000
 *
 * Creates a THROWAWAY tenant, seeds `count` applications, times the CRM list
 * query (the `application_list_items` view — a single statement, so no N+1 by
 * construction), a filtered query and a search query, then deletes everything
 * it created. Never touches existing tenants. Do not run against production.
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

const CITIES = ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Curitiba", "Recife"];
const STATES = ["SP", "RJ", "MG", "PR", "PE"];

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
  console.log(`Seeding a throwaway tenant with ${COUNT} applications…`);

  const user = await admin.auth.admin.createUser({
    email: `perf-${stamp}@example.test`,
    password: `Pp1!${stamp}xyz`,
    email_confirm: true,
  });
  const userId = user.data.user.id;

  const org = await admin
    .from("organizations")
    .insert({ name: "Perf", slug: `perf-${stamp}` })
    .select("id")
    .single();
  const orgId = org.data.id;

  await admin
    .from("organization_members")
    .insert({ organization_id: orgId, user_id: userId, role: "owner" });

  const program = await admin
    .from("programs")
    .insert({
      organization_id: orgId,
      name: "Perf program",
      slug: "creators",
      status: "active",
      form_version: 1,
    })
    .select("id")
    .single();
  const programId = program.data.id;

  const STATUSES = ["new", "awaiting_review", "information_requested", "approved", "archived"];
  for (let start = 0; start < COUNT; start += 500) {
    const n = Math.min(500, COUNT - start);
    const creators = Array.from({ length: n }, (_, k) => {
      const i = start + k;
      return {
        organization_id: orgId,
        full_name: `Perf Creator ${i}`,
        email: `perf${i}@example.test`,
        phone_e164: `+55119${String(i).padStart(8, "0")}`,
        city: CITIES[i % CITIES.length],
        state: STATES[i % STATES.length],
      };
    });
    const inserted = await admin.from("creators").insert(creators).select("id");
    if (inserted.error) throw inserted.error;

    const socials = inserted.data.map((c, k) => ({
      organization_id: orgId,
      creator_id: c.id,
      platform: "instagram",
      handle: `perf_${start + k}`,
      handle_normalized: `perf_${start + k}`,
      followers_declared: 1000 + ((start + k) % 90000),
    }));
    const s = await admin.from("creator_social_profiles").insert(socials);
    if (s.error) throw s.error;

    const apps = inserted.data.map((c, k) => ({
      organization_id: orgId,
      program_id: programId,
      creator_id: c.id,
      status: STATUSES[(start + k) % STATUSES.length],
      form_version: 1,
      possible_duplicate: (start + k) % 50 === 0,
      submitted_at: new Date(Date.now() - (start + k) * 60000).toISOString(),
    }));
    const a = await admin.from("applications").insert(apps);
    if (a.error) throw a.error;
    process.stdout.write(`\r  ${start + n}/${COUNT}`);
  }
  console.log("");

  const member = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await member.auth.signInWithPassword({
    email: `perf-${stamp}@example.test`,
    password: `Pp1!${stamp}xyz`,
  });

  console.log("\nCRM list queries (as an authenticated member, RLS on):");
  await time("page 1, recent", () =>
    member
      .from("application_list_items")
      .select("*", { count: "exact" })
      .eq("organization_id", orgId)
      .order("submitted_at", { ascending: false })
      .order("id", { ascending: false })
      .range(0, 50),
  );
  await time("filter status=new + has_ig, top followers", () =>
    member
      .from("application_list_items")
      .select("*")
      .eq("organization_id", orgId)
      .eq("status", "new")
      .not("instagram_handle", "is", null)
      .order("instagram_followers", { ascending: false, nullsFirst: false })
      .range(0, 50),
  );
  await time("search 'Creator 4'", () =>
    member
      .from("application_list_items")
      .select("*")
      .eq("organization_id", orgId)
      .or(
        "creator_name.ilike.*Creator 4*,creator_email.ilike.*Creator 4*,instagram_handle_normalized.ilike.*creator 4*",
      )
      .order("submitted_at", { ascending: false })
      .range(0, 50),
  );
  await time("crm_counts RPC", () => member.rpc("crm_counts", {}));

  console.log("\nNote: the list is ONE select on the view — no per-row queries.");

  console.log("\nCleaning up…");
  await admin.from("applications").delete().eq("organization_id", orgId);
  await admin.from("creator_events").delete().eq("organization_id", orgId);
  await admin.from("organizations").delete().eq("id", orgId);
  await admin.auth.admin.deleteUser(userId);
  console.log("Done.");
}

main().catch((err) => {
  console.error("\nperf-check failed:", err.message);
  console.error("You may need to clean up an org with slug perf-" + stamp);
  process.exit(1);
});
