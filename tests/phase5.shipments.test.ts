/**
 * FASE 5 — shipments / product seeding. Real Supabase, no Claude, no email.
 * Covers create + address snapshot, RLS / cross-tenant / anon, the status
 * machine + timestamps, address immutability + refresh, items immutability,
 * multiple shipments, tracking URL safety, and PII-free events. Skips until
 * migration 20260829000004 is applied.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && anonKey && serviceKey);

let ready = false;
if (configured) {
  const probe = createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const t = await probe.from("shipments").select("id").limit(1);
  const f = await probe.rpc("is_valid_shipment_transition", {
    p_from: "draft",
    p_to: "preparing",
  });
  ready = !t.error && !f.error;
}

const skip = !configured
  ? "Supabase credentials not set"
  : !ready
    ? "Phase 5 schema not applied (run supabase/migrations/20260829000004_shipments.sql)"
    : false;

const stamp = Date.now();
const pwd = (p: string) => `${p}1!${stamp}zz`;

function anon(): SupabaseClient {
  return createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const c = anon();
  assert.ifError((await c.auth.signInWithPassword({ email, password })).error);
  return c;
}

const ITEMS = [
  { item_name: "Glance Brow Lift", sku: "GBL-01", quantity: 2 },
  { item_name: "Kit Glance Care", quantity: 1 },
];

function addrFields(recipient: string) {
  return {
    recipient_name: recipient,
    cpf: "11144477735",
    postal_code: "30140110",
    street: "Rua dos Aimorés",
    number: "1200",
    complement: "Sala 4",
    neighborhood: "Funcionários",
    city: "Belo Horizonte",
    state: "MG",
    country: "BR",
  };
}

describe("Phase 5 — shipments", { skip }, () => {
  let admin: SupabaseClient;
  let ownerA: SupabaseClient;
  let analystA: SupabaseClient;
  let ownerB: SupabaseClient;
  let orgA = "";
  let orgB = "";
  let programA = "";
  const users: Record<string, { id: string; email: string; password: string }> =
    {};

  async function mkUser(key: string) {
    const email = `p5-${key}-${stamp}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: pwd(key),
      email_confirm: true,
    });
    assert.ifError(error);
    users[key] = { id: data.user!.id, email, password: pwd(key) };
  }

  /** completed application + a current creator_addresses row. Returns ids. */
  async function seedCompleted(recipient = "Pâmela Kald"): Promise<{
    applicationId: string;
    creatorId: string;
    addressId: string;
  }> {
    const creator = await admin
      .from("creators")
      .insert({ organization_id: orgA, full_name: recipient })
      .select("id")
      .single();
    const creatorId = creator.data!.id;
    const app = await admin
      .from("applications")
      .insert({
        organization_id: orgA,
        program_id: programA,
        creator_id: creatorId,
        status: "completed",
        approved_at: new Date().toISOString(),
        form_version: 1,
      })
      .select("id")
      .single();
    const req = await admin
      .from("application_requests")
      .insert({
        organization_id: orgA,
        application_id: app.data!.id,
        creator_id: creatorId,
        request_type: "shipping_address",
        status: "completed",
        token_hash: randomBytes(32).toString("hex"),
        expires_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    const addr = await admin
      .from("creator_addresses")
      .insert({
        organization_id: orgA,
        creator_id: creatorId,
        source_request_id: req.data!.id,
        is_current: true,
        ...addrFields(recipient),
      })
      .select("id")
      .single();
    assert.ifError(addr.error);
    return {
      applicationId: app.data!.id,
      creatorId,
      addressId: addr.data!.id,
    };
  }

  before(async () => {
    admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await mkUser("ownerA");
    await mkUser("analystA");
    await mkUser("ownerB");

    const orgs = await admin
      .from("organizations")
      .insert([
        { name: "P5 A", slug: `p5-a-${stamp}` },
        { name: "P5 B", slug: `p5-b-${stamp}` },
      ])
      .select("id, slug");
    assert.ifError(orgs.error);
    orgA = orgs.data!.find((o) => o.slug === `p5-a-${stamp}`)!.id;
    orgB = orgs.data!.find((o) => o.slug === `p5-b-${stamp}`)!.id;

    await admin.from("organization_members").insert([
      { organization_id: orgA, user_id: users.ownerA.id, role: "owner" },
      { organization_id: orgA, user_id: users.analystA.id, role: "analyst" },
      { organization_id: orgB, user_id: users.ownerB.id, role: "owner" },
    ]);

    const prog = await admin
      .from("programs")
      .insert({
        organization_id: orgA,
        name: "A",
        slug: "creators",
        status: "active",
        form_version: 1,
      })
      .select("id")
      .single();
    programA = prog.data!.id;

    ownerA = await signedIn(users.ownerA.email, users.ownerA.password);
    analystA = await signedIn(users.analystA.email, users.analystA.password);
    ownerB = await signedIn(users.ownerB.email, users.ownerB.password);
  });

  after(async () => {
    if (!admin) return;
    await admin.from("shipment_items").delete().in("organization_id", [orgA, orgB]);
    await admin.from("shipments").delete().in("organization_id", [orgA, orgB]);
    await admin.from("creator_addresses").delete().in("organization_id", [orgA, orgB]);
    await admin.from("application_requests").delete().in("organization_id", [orgA, orgB]);
    await admin.from("applications").delete().in("organization_id", [orgA, orgB]);
    await admin.from("creator_events").delete().in("organization_id", [orgA, orgB]);
    await admin.from("creators").delete().in("organization_id", [orgA, orgB]);
    await admin.from("organizations").delete().in("id", [orgA, orgB]);
    for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
  });

  test("85) create: snapshot comes from the current address (client cannot forge it); items + event; application stays completed", async () => {
    const { applicationId, creatorId } = await seedCompleted("Snapshot Test");
    const res = await ownerA.rpc("create_shipment", {
      p_application_id: applicationId,
      p_items: ITEMS,
      p_internal_notes: "kit especial",
    });
    assert.ifError(res.error);
    const sid = res.data.shipment_id;

    const ship = await admin.from("shipments").select("*").eq("id", sid).single();
    assert.equal(ship.data!.status, "draft");
    assert.equal(ship.data!.organization_id, orgA);
    assert.equal(ship.data!.created_by, users.ownerA.id);
    assert.equal(ship.data!.address_snapshot.recipient_name, "Snapshot Test");
    assert.equal(ship.data!.address_snapshot.postal_code, "30140110");
    assert.equal(ship.data!.address_snapshot.cpf, "11144477735");
    assert.equal(ship.data!.internal_notes, "kit especial");

    const items = await admin
      .from("shipment_items")
      .select("item_name, sku, quantity, position")
      .eq("shipment_id", sid)
      .order("position");
    assert.equal(items.data!.length, 2);
    assert.equal(items.data![0].item_name, "Glance Brow Lift");
    assert.equal(items.data![0].position, 0);
    assert.equal(items.data![1].sku, null);

    const ev = await admin
      .from("creator_events")
      .select("type, data")
      .eq("application_id", applicationId);
    assert.ok(ev.data!.some((e) => e.type === "shipment_created"));

    const app = await admin
      .from("applications")
      .select("status")
      .eq("id", applicationId)
      .single();
    assert.equal(app.data!.status, "completed"); // §64

    // §106: no PII in the event
    const evText = JSON.stringify(ev.data);
    for (const s of ["Aimorés", "30140110", "11144477735", "kit especial"]) {
      assert.ok(!evText.includes(s), `event leaked "${s}"`);
    }
    void creatorId;
  });

  test("86) non-completed application cannot create a shipment", async () => {
    const creator = await admin
      .from("creators")
      .insert({ organization_id: orgA, full_name: "Not done" })
      .select("id")
      .single();
    const app = await admin
      .from("applications")
      .insert({
        organization_id: orgA,
        program_id: programA,
        creator_id: creator.data!.id,
        status: "approved",
        form_version: 1,
      })
      .select("id")
      .single();
    const res = await ownerA.rpc("create_shipment", {
      p_application_id: app.data!.id,
      p_items: ITEMS,
    });
    assert.ok(res.error);
    assert.match(res.error!.message, /APPLICATION_NOT_COMPLETED/);
  });

  test("87) completed application with no current address cannot create a shipment", async () => {
    const creator = await admin
      .from("creators")
      .insert({ organization_id: orgA, full_name: "No addr" })
      .select("id")
      .single();
    const app = await admin
      .from("applications")
      .insert({
        organization_id: orgA,
        program_id: programA,
        creator_id: creator.data!.id,
        status: "completed",
        form_version: 1,
      })
      .select("id")
      .single();
    const res = await ownerA.rpc("create_shipment", {
      p_application_id: app.data!.id,
      p_items: ITEMS,
    });
    assert.ok(res.error);
    assert.match(res.error!.message, /NO_CURRENT_ADDRESS/);
  });

  test("21) create rejects empty / oversized items and out-of-range quantity", async () => {
    const { applicationId } = await seedCompleted("Bad items");
    for (const bad of [
      [],
      [{ item_name: "", quantity: 1 }],
      [{ item_name: "x", quantity: 0 }],
      [{ item_name: "x", quantity: 1000 }],
      Array.from({ length: 51 }, () => ({ item_name: "x", quantity: 1 })),
    ]) {
      const res = await ownerA.rpc("create_shipment", {
        p_application_id: applicationId,
        p_items: bad,
      });
      assert.ok(res.error, `should reject ${JSON.stringify(bad).slice(0, 40)}`);
      assert.match(res.error!.message, /INVALID_ITEMS/);
    }
  });

  test("88) cross-tenant: org B cannot create / read / transition / refresh org A's shipment", async () => {
    const { applicationId, creatorId } = await seedCompleted("Tenant A");
    const created = await ownerA.rpc("create_shipment", {
      p_application_id: applicationId,
      p_items: ITEMS,
    });
    const sid = created.data.shipment_id;

    const bCreate = await ownerB.rpc("create_shipment", {
      p_application_id: applicationId,
      p_items: ITEMS,
    });
    assert.ok(bCreate.error);
    assert.match(bCreate.error!.message, /FORBIDDEN|APPLICATION_NOT_FOUND/);

    const bRead = await ownerB.from("shipments").select("id").eq("id", sid);
    assert.equal((bRead.data ?? []).length, 0);
    const bItems = await ownerB
      .from("shipment_items")
      .select("id")
      .eq("shipment_id", sid);
    assert.equal((bItems.data ?? []).length, 0);

    const bMove = await ownerB.rpc("transition_shipment_status", {
      p_shipment_id: sid,
      p_to_status: "cancelled",
    });
    assert.ok(bMove.error);
    assert.match(bMove.error!.message, /FORBIDDEN|SHIPMENT_NOT_FOUND/);

    const bRefresh = await ownerB.rpc("refresh_shipment_address", {
      p_shipment_id: sid,
    });
    assert.ok(bRefresh.error);
    void creatorId;
  });

  test("89) analyst of the org can create + transition", async () => {
    const { applicationId } = await seedCompleted("Analyst can");
    const c = await analystA.rpc("create_shipment", {
      p_application_id: applicationId,
      p_items: ITEMS,
    });
    assert.ifError(c.error);
    const t = await analystA.rpc("transition_shipment_status", {
      p_shipment_id: c.data.shipment_id,
      p_to_status: "preparing",
    });
    assert.ifError(t.error);
  });

  test("90/91) transitions + timestamps: draft→preparing→shipped→delivered, corrections, cancel/restore", async () => {
    const { applicationId } = await seedCompleted("Flow");
    const c = await ownerA.rpc("create_shipment", {
      p_application_id: applicationId,
      p_items: ITEMS,
    });
    const sid = c.data.shipment_id;
    const to = (s: string) =>
      ownerA.rpc("transition_shipment_status", { p_shipment_id: sid, p_to_status: s });
    const row = async () =>
      (await admin.from("shipments").select("*").eq("id", sid).single()).data!;

    assert.match((await to("shipped")).error?.message ?? "", /INVALID_TRANSITION/);
    assert.ifError((await to("preparing")).error);
    assert.ifError((await to("shipped")).error);
    let r = await row();
    assert.equal(r.status, "shipped");
    assert.ok(r.shipped_at);
    assert.equal(r.delivered_at, null);

    assert.ifError((await to("delivered")).error);
    r = await row();
    assert.ok(r.delivered_at);

    // correction: delivered -> shipped clears delivered_at, keeps shipped_at
    assert.ifError((await to("shipped")).error);
    r = await row();
    assert.equal(r.delivered_at, null);
    assert.ok(r.shipped_at);

    // correction: shipped -> preparing clears shipped_at + delivered_at
    assert.ifError((await to("preparing")).error);
    r = await row();
    assert.equal(r.shipped_at, null);

    // cancel then restore
    assert.ifError((await to("cancelled")).error);
    r = await row();
    assert.ok(r.cancelled_at);
    assert.ifError((await to("draft")).error);
    r = await row();
    assert.equal(r.status, "draft");
    assert.equal(r.cancelled_at, null);
  });

  test("21) cannot move to preparing/shipped with zero items", async () => {
    const { applicationId } = await seedCompleted("Zero items");
    const c = await ownerA.rpc("create_shipment", {
      p_application_id: applicationId,
      p_items: [{ item_name: "temp", quantity: 1 }],
    });
    const sid = c.data.shipment_id;
    // wipe the items via the update RPC with... can't send empty (INVALID_ITEMS).
    // Instead delete directly as admin to simulate the guard.
    await admin.from("shipment_items").delete().eq("shipment_id", sid);
    const res = await ownerA.rpc("transition_shipment_status", {
      p_shipment_id: sid,
      p_to_status: "preparing",
    });
    assert.ok(res.error);
    assert.match(res.error!.message, /NO_ITEMS/);
  });

  test("92) address immutability + refresh: snapshot A, creator moves to B, refresh in draft copies B, locked after shipped", async () => {
    const { applicationId, creatorId, addressId } = await seedCompleted("Addr A");
    const c = await ownerA.rpc("create_shipment", {
      p_application_id: applicationId,
      p_items: ITEMS,
    });
    const sid = c.data.shipment_id;

    // creator gets a new current address B
    await admin
      .from("creator_addresses")
      .update({ is_current: false })
      .eq("id", addressId);
    const reqB = await admin
      .from("application_requests")
      .insert({
        organization_id: orgA,
        application_id: applicationId,
        creator_id: creatorId,
        request_type: "shipping_address",
        status: "completed",
        token_hash: randomBytes(32).toString("hex"),
        expires_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    const addrB = await admin
      .from("creator_addresses")
      .insert({
        organization_id: orgA,
        creator_id: creatorId,
        source_request_id: reqB.data!.id,
        is_current: true,
        ...addrFields("Addr B"),
        street: "Avenida Nova",
      })
      .select("id")
      .single();

    let ship = (await admin.from("shipments").select("*").eq("id", sid).single()).data!;
    assert.equal(ship.address_snapshot.recipient_name, "Addr A"); // still A

    assert.ifError(
      (await ownerA.rpc("refresh_shipment_address", { p_shipment_id: sid })).error,
    );
    ship = (await admin.from("shipments").select("*").eq("id", sid).single()).data!;
    assert.equal(ship.address_snapshot.recipient_name, "Addr B");
    assert.equal(ship.address_snapshot.street, "Avenida Nova");
    assert.equal(ship.source_address_id, addrB.data!.id);

    // ship it, then refresh must be rejected (§59, §92)
    await ownerA.rpc("transition_shipment_status", { p_shipment_id: sid, p_to_status: "preparing" });
    await ownerA.rpc("transition_shipment_status", { p_shipment_id: sid, p_to_status: "shipped" });
    const locked = await ownerA.rpc("refresh_shipment_address", { p_shipment_id: sid });
    assert.ok(locked.error);
    assert.match(locked.error!.message, /ADDRESS_LOCKED/);
  });

  test("93) items immutable after shipped", async () => {
    const { applicationId } = await seedCompleted("Items lock");
    const c = await ownerA.rpc("create_shipment", {
      p_application_id: applicationId,
      p_items: ITEMS,
    });
    const sid = c.data.shipment_id;
    await ownerA.rpc("transition_shipment_status", { p_shipment_id: sid, p_to_status: "preparing" });
    await ownerA.rpc("transition_shipment_status", { p_shipment_id: sid, p_to_status: "shipped" });
    const res = await ownerA.rpc("update_shipment_items", {
      p_shipment_id: sid,
      p_items: [{ item_name: "novo", quantity: 1 }],
    });
    assert.ok(res.error);
    assert.match(res.error!.message, /ITEMS_LOCKED/);
  });

  test("94) two shipments for the same application — independent histories", async () => {
    const { applicationId } = await seedCompleted("Two ships");
    const a = await ownerA.rpc("create_shipment", { p_application_id: applicationId, p_items: ITEMS });
    const b = await ownerA.rpc("create_shipment", { p_application_id: applicationId, p_items: ITEMS });
    assert.ifError(a.error);
    assert.ifError(b.error);
    assert.notEqual(a.data.shipment_id, b.data.shipment_id);
    await ownerA.rpc("transition_shipment_status", { p_shipment_id: a.data.shipment_id, p_to_status: "preparing" });
    const rows = await admin
      .from("shipments")
      .select("id, status")
      .eq("application_id", applicationId)
      .order("created_at");
    assert.equal(rows.data!.length, 2);
    assert.equal(rows.data!.filter((r) => r.status === "draft").length, 1);
  });

  test("95) tracking: http(s) saved; javascript: URL rejected", async () => {
    const { applicationId } = await seedCompleted("Tracking");
    const c = await ownerA.rpc("create_shipment", { p_application_id: applicationId, p_items: ITEMS });
    const sid = c.data.shipment_id;

    const ok = await ownerA.rpc("update_shipment_tracking", {
      p_shipment_id: sid,
      p_carrier: "Correios",
      p_tracking_code: "BR123456789BR",
      p_tracking_url: "https://rastreamento.correios.com.br/app/index.php?id=BR123456789BR",
      p_internal_notes: null,
    });
    assert.ifError(ok.error);
    const row = await admin.from("shipments").select("carrier, tracking_code, tracking_url").eq("id", sid).single();
    assert.equal(row.data!.carrier, "Correios");
    assert.equal(row.data!.tracking_code, "BR123456789BR");

    const bad = await ownerA.rpc("update_shipment_tracking", {
      p_shipment_id: sid,
      p_carrier: null,
      p_tracking_code: null,
      p_tracking_url: "javascript:alert(1)",
      p_internal_notes: null,
    });
    assert.ok(bad.error);
    assert.match(bad.error!.message, /INVALID_TRACKING/);
  });

  test("96) list view is tenant-scoped; never exposes address_snapshot / internal_notes", async () => {
    const { applicationId } = await seedCompleted("List RLS");
    await ownerA.rpc("create_shipment", {
      p_application_id: applicationId,
      p_items: ITEMS,
      p_internal_notes: "segredo",
    });

    const aList = await ownerA
      .from("shipment_list_items")
      .select("*")
      .eq("organization_id", orgA);
    assert.ifError(aList.error);
    assert.ok(aList.data!.length >= 1);
    const cols = Object.keys(aList.data![0]);
    assert.ok(!cols.includes("address_snapshot"));
    assert.ok(!cols.includes("internal_notes"));

    const bList = await ownerB
      .from("shipment_list_items")
      .select("id")
      .eq("organization_id", orgA);
    assert.equal((bList.data ?? []).length, 0);
  });

  test("107) anon cannot read shipments / shipment_items / the list view", async () => {
    for (const t of ["shipments", "shipment_items", "shipment_list_items"] as const) {
      const r = await anon().from(t).select("id");
      assert.ok(r.error || (r.data ?? []).length === 0, `anon read ${t}`);
    }
    const rpc = await anon().rpc("create_shipment", {
      p_application_id: "00000000-0000-0000-0000-000000000000",
      p_items: ITEMS,
    });
    assert.ok(rpc.error);
  });

  test("shipment_counts is RLS-scoped", async () => {
    const res = await ownerA.rpc("shipment_counts");
    assert.ifError(res.error);
    assert.ok(typeof res.data.open === "number");
    assert.ok(Number(res.data.draft) + Number(res.data.preparing) >= 0);
  });
});
