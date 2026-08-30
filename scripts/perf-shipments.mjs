/**
 * FASE 5 — shipments list rough performance check against the real database.
 *
 *   node scripts/perf-shipments.mjs [count]      # default 1000
 *
 * Creates a THROWAWAY tenant, one completed application with an address, then
 * `count` shipments (each with 2 items). Times the operational list queries:
 * page 1, a status filter, a creator search, and shipment_counts. Deletes
 * everything it created. Never touches existing tenants. Do not run against
 * production.
 */
import { randomBytes } from "node:crypto";
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
const STATUSES = ["draft", "preparing", "shipped", "delivered", "cancelled"];

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
  console.log(`Seeding a throwaway tenant with ${COUNT} shipments…`);

  const user = await admin.auth.admin.createUser({
    email: `perfship-${stamp}@example.test`,
    password: `Pp1!${stamp}xyz`,
    email_confirm: true,
  });
  const userId = user.data.user.id;
  const org = await admin
    .from("organizations")
    .insert({ name: "Perf Ship", slug: `perfship-${stamp}` })
    .select("id")
    .single();
  const orgId = org.data.id;
  await admin
    .from("organization_members")
    .insert({ organization_id: orgId, user_id: userId, role: "owner" });
  const program = await admin
    .from("programs")
    .insert({ organization_id: orgId, name: "Perf", slug: "creators", status: "active", form_version: 1 })
    .select("id")
    .single();
  const creator = await admin
    .from("creators")
    .insert({ organization_id: orgId, full_name: "Perf Ship Creator" })
    .select("id")
    .single();
  const app = await admin
    .from("applications")
    .insert({ organization_id: orgId, program_id: program.data.id, creator_id: creator.data.id, status: "completed", form_version: 1 })
    .select("id")
    .single();
  const req = await admin
    .from("application_requests")
    .insert({ organization_id: orgId, application_id: app.data.id, creator_id: creator.data.id, request_type: "shipping_address", status: "completed", token_hash: randomBytes(32).toString("hex"), expires_at: new Date().toISOString() })
    .select("id")
    .single();
  const addr = await admin
    .from("creator_addresses")
    .insert({ organization_id: orgId, creator_id: creator.data.id, source_request_id: req.data.id, is_current: true, recipient_name: "Perf", postal_code: "30140110", street: "Rua X", number: "1", neighborhood: "Centro", city: "Belo Horizonte", state: "MG", country: "BR" })
    .select("id")
    .single();

  const snapshot = {
    recipient_name: "Perf", postal_code: "30140110",
    street: "Rua X", number: "1", complement: null, neighborhood: "Centro",
    city: "Belo Horizonte", state: "MG", country: "BR",
  };

  for (let start = 0; start < COUNT; start += 500) {
    const n = Math.min(500, COUNT - start);
    const rows = Array.from({ length: n }, (_, k) => ({
      organization_id: orgId,
      creator_id: creator.data.id,
      application_id: app.data.id,
      source_address_id: addr.data.id,
      address_snapshot: snapshot,
      status: STATUSES[(start + k) % STATUSES.length],
      carrier: (start + k) % 3 === 0 ? "Correios" : null,
    }));
    const ins = await admin.from("shipments").insert(rows).select("id");
    if (ins.error) throw ins.error;
    const items = ins.data.flatMap((s) => [
      { shipment_id: s.id, organization_id: orgId, item_name: "Glance Brow Lift", quantity: 2, position: 0 },
      { shipment_id: s.id, organization_id: orgId, item_name: "Kit Glance Care", quantity: 1, position: 1 },
    ]);
    const it = await admin.from("shipment_items").insert(items);
    if (it.error) throw it.error;
    process.stdout.write(`\r  ${start + n}/${COUNT}`);
  }
  console.log("");

  const member = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await member.auth.signInWithPassword({
    email: `perfship-${stamp}@example.test`,
    password: `Pp1!${stamp}xyz`,
  });

  console.log("\nShipments list queries (authenticated member, RLS on):");
  await time("page 1, recent", () =>
    member
      .from("shipment_list_items")
      .select("*", { count: "exact" })
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .range(0, 50),
  );
  await time("filter status=shipped", () =>
    member
      .from("shipment_list_items")
      .select("*")
      .eq("organization_id", orgId)
      .eq("status", "shipped")
      .order("created_at", { ascending: false })
      .range(0, 50),
  );
  await time("search creator 'Perf'", () =>
    member
      .from("shipment_list_items")
      .select("*")
      .eq("organization_id", orgId)
      .or("creator_name.ilike.*Perf*,creator_email.ilike.*Perf*,tracking_code.ilike.*Perf*")
      .range(0, 50),
  );
  await time("shipment_counts RPC", () => member.rpc("shipment_counts", {}));

  console.log("\nNote: the list is ONE select on the view — no per-row queries.");

  console.log("\nCleaning up…");
  await admin.from("shipment_items").delete().eq("organization_id", orgId);
  await admin.from("shipments").delete().eq("organization_id", orgId);
  await admin.from("creator_addresses").delete().eq("organization_id", orgId);
  await admin.from("application_requests").delete().eq("organization_id", orgId);
  await admin.from("applications").delete().eq("organization_id", orgId);
  await admin.from("creators").delete().eq("organization_id", orgId);
  await admin.from("organizations").delete().eq("id", orgId);
  await admin.auth.admin.deleteUser(userId);
  console.log("Done.");
}

main().catch((err) => {
  console.error("\nperf-shipments failed:", err.message);
  console.error(`You may need to clean up an org with slug perfship-${stamp}`);
  process.exit(1);
});
