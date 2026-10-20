/**
 * FASE 9 — Shopify sales attribution + commissions (real Supabase).
 *
 * Covers the ingest-key gate on the anon RPCs, the no-select secrets table,
 * admin-only writes, coupon/UTM attribution, retroactive attribution, the
 * commission lifecycle (pending → approved → paid, reversed on cancel, paid is
 * frozen) and tenant isolation. Skips until 20261020000001 is applied.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* no .env.local */
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configured = Boolean(url && anonKey && serviceKey);

let ready = false;
if (configured) {
  const probe = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  ready = !(await probe.from("commissions").select("id").limit(1)).error;
}
const skip = !configured
  ? "Supabase credentials not set"
  : !ready
    ? "migration 20261020000001_shopify_commissions.sql not applied"
    : false;

const stamp = Date.now();
const pwd = (p: string) => `${p}1!${stamp}zz`;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

function anon(): SupabaseClient {
  return createClient(url!, anonKey!, { auth: { persistSession: false, autoRefreshToken: false } });
}
async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const c = anon();
  assert.ifError((await c.auth.signInWithPassword({ email, password })).error);
  return c;
}

function order(id: string, over: Record<string, unknown> = {}) {
  return {
    id: `gid://shopify/Order/${stamp}${id}`,
    name: `#${id}`,
    processed_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    cancelled_at: null,
    financial_status: "PAID",
    currency: "BRL",
    subtotal: 200,
    total_discounts: 20,
    total_refunded: 0,
    discount_codes: [],
    utm_last: null,
    utm_first: null,
    test: false,
    ...over,
  };
}

describe("Phase 9 — Shopify commissions", { skip }, () => {
  let admin: SupabaseClient;
  let ownerA: SupabaseClient;
  let analystA: SupabaseClient;
  let ownerB: SupabaseClient;
  let orgA = "";
  let orgB = "";
  const creators: Record<string, string> = {};
  const users: Record<string, { id: string; email: string; password: string }> = {};
  const keyA = randomBytes(32).toString("hex");
  const shopA = `p9-a-${stamp}.myshopify.com`;

  async function mkUser(k: string) {
    const email = `p9-${k}-${stamp}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({ email, password: pwd(k), email_confirm: true });
    assert.ifError(error);
    users[k] = { id: data.user!.id, email, password: pwd(k) };
  }
  async function mkCreator(name: string) {
    const r = await admin.from("creators").insert({ organization_id: orgA, full_name: name }).select("id").single();
    assert.ifError(r.error);
    creators[name] = r.data!.id;
  }
  const ingest = (orders: unknown[], key = keyA, client = anon()) =>
    client.rpc("shopify_ingest_orders", { p_org: orgA, p_ingest_key: key, p_orders: orders });
  const orderRow = (id: string) =>
    admin
      .from("shopify_orders")
      .select("id, creator_id, attribution")
      .eq("organization_id", orgA)
      .eq("shopify_order_id", `gid://shopify/Order/${stamp}${id}`)
      .single();
  const commissionOf = async (id: string) => {
    const o = await orderRow(id);
    return admin.from("commissions").select("*").eq("order_id", o.data!.id).maybeSingle();
  };

  before(async () => {
    admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
    await mkUser("ownerA");
    await mkUser("analystA");
    await mkUser("ownerB");
    const orgs = await admin
      .from("organizations")
      .insert([
        { name: "P9 A", slug: `p9-a-${stamp}` },
        { name: "P9 B", slug: `p9-b-${stamp}` },
      ])
      .select("id, slug");
    assert.ifError(orgs.error);
    orgA = orgs.data!.find((o) => o.slug === `p9-a-${stamp}`)!.id;
    orgB = orgs.data!.find((o) => o.slug === `p9-b-${stamp}`)!.id;
    await admin.from("organization_members").insert([
      { organization_id: orgA, user_id: users.ownerA.id, role: "owner" },
      { organization_id: orgA, user_id: users.analystA.id, role: "analyst" },
      { organization_id: orgB, user_id: users.ownerB.id, role: "owner" },
    ]);
    await mkCreator("Mariana");
    await mkCreator("Ana");
    await mkCreator("Bia");
    ownerA = await signedIn(users.ownerA.email, users.ownerA.password);
    analystA = await signedIn(users.analystA.email, users.analystA.password);
    ownerB = await signedIn(users.ownerB.email, users.ownerB.password);
  });

  after(async () => {
    if (!admin) return;
    await admin.from("organizations").delete().in("id", [orgA, orgB]);
    for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
  });

  test("connect: analyst refused, owner connects; secrets table not selectable", async () => {
    const args = {
      p_org: orgA,
      p_shop_domain: shopA,
      p_client_id: "client-id-123",
      p_secret_enc: "v1.ciphertext",
      p_token_enc: "v1.token",
      p_token_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      p_scopes: "read_orders,write_discounts",
      p_ingest_key_hash: sha(keyA),
    };
    const bad = await analystA.rpc("shopify_connect", args);
    assert.match(bad.error?.message ?? "", /FORBIDDEN/);
    const ok = await ownerA.rpc("shopify_connect", args);
    assert.ifError(ok.error);

    const direct = await ownerA.from("shopify_connections").select("*");
    assert.ok(direct.error || (direct.data ?? []).length === 0, "secrets table must not be readable");

    const st = await analystA.rpc("shopify_connection_status", { p_org: orgA });
    assert.ifError(st.error);
    assert.equal(st.data.shop_domain, shopA);
    assert.ok(!JSON.stringify(st.data).includes("ciphertext"), "status exposes no ciphertext");

    const other = await ownerB.rpc("shopify_connection_status", { p_org: orgA });
    assert.match(other.error?.message ?? "", /FORBIDDEN/);
  });

  test("ingest: wrong or missing key refused; same domain cannot join another org", async () => {
    const wrong = await ingest([order("1")], randomBytes(32).toString("hex"));
    assert.match(wrong.error?.message ?? "", /FORBIDDEN/);
    const missing = await ingest([order("1")], "");
    assert.match(missing.error?.message ?? "", /FORBIDDEN/);
    const steal = await ownerB.rpc("shopify_connect", {
      p_org: orgB,
      p_shop_domain: shopA,
      p_client_id: "x-client-id",
      p_secret_enc: "x",
      p_token_enc: "x",
      p_token_expires_at: new Date().toISOString(),
      p_scopes: "",
      p_ingest_key_hash: sha("b"),
    });
    assert.match(steal.error?.message ?? "", /SHOP_ALREADY_CONNECTED/);
  });

  test("affiliation: analyst refused, owner saves; code is unique per org", async () => {
    const base = { p_org: orgA, p_discount_percent: 10, p_shopify_discount_id: null };
    const bad = await analystA.rpc("set_creator_affiliation", {
      ...base, p_creator_id: creators.Mariana, p_code: "MARIANA", p_commission_rate: 10,
    });
    assert.match(bad.error?.message ?? "", /FORBIDDEN/);
    assert.ifError((await ownerA.rpc("set_creator_affiliation", {
      ...base, p_creator_id: creators.Mariana, p_code: "mariana", p_commission_rate: 10,
    })).error);
    assert.ifError((await ownerA.rpc("set_creator_affiliation", {
      ...base, p_creator_id: creators.Ana, p_code: "ANA", p_commission_rate: 15,
    })).error);
    const dup = await ownerA.rpc("set_creator_affiliation", {
      ...base, p_creator_id: creators.Bia, p_code: "ANA", p_commission_rate: 5,
    });
    assert.match(dup.error?.message ?? "", /CODE_TAKEN/);
  });

  test("attribution: coupon beats UTM; UTM last visit; commission = subtotal × rate", async () => {
    const r = await ingest([
      order("10", { discount_codes: ["mariana"], utm_last: { campaign: "ANA" } }),
      order("11", { utm_last: { content: "ana" } }),
      order("12", { utm_first: { campaign: "MARIANA" } }),
      order("13"),
    ]);
    assert.ifError(r.error);
    assert.equal(r.data.orders, 4);

    assert.equal((await orderRow("10")).data!.creator_id, creators.Mariana);
    assert.equal((await orderRow("10")).data!.attribution, "coupon");
    assert.equal((await orderRow("11")).data!.creator_id, creators.Ana);
    assert.equal((await orderRow("11")).data!.attribution, "utm_last");
    assert.equal((await orderRow("12")).data!.attribution, "utm_first");
    assert.equal((await orderRow("13")).data!.creator_id, null);

    const c10 = (await commissionOf("10")).data!;
    assert.equal(Number(c10.amount), 20); // 200 × 10%
    assert.equal(c10.status, "pending");
    assert.equal(Number((await commissionOf("11")).data!.amount), 30); // 200 × 15%
    assert.equal((await commissionOf("13")).data, null);
  });

  test("UTM arriving later is merged, not overwritten by a null", async () => {
    await ingest([order("20")]);
    assert.equal((await orderRow("20")).data!.creator_id, null);
    await ingest([order("20", { utm_last: { campaign: "ANA" } })]);
    assert.equal((await orderRow("20")).data!.creator_id, creators.Ana);
    await ingest([order("20", { utm_last: null })]);
    assert.equal((await orderRow("20")).data!.creator_id, creators.Ana, "null keeps stored UTM");
  });

  test("retroactive: registering a code attributes earlier orders", async () => {
    await ingest([order("30", { discount_codes: ["BIA"] })]);
    assert.equal((await orderRow("30")).data!.creator_id, null);
    assert.ifError((await ownerA.rpc("set_creator_affiliation", {
      p_org: orgA, p_creator_id: creators.Bia, p_code: "BIA", p_commission_rate: 5,
      p_discount_percent: null, p_shopify_discount_id: null,
    })).error);
    assert.equal((await orderRow("30")).data!.creator_id, creators.Bia);
    assert.equal(Number((await commissionOf("30")).data!.amount), 10);
  });

  test("lifecycle: unpaid → awaiting; cancel → reversed; approved after hold; paid frozen", async () => {
    await ingest([order("40", { discount_codes: ["MARIANA"], financial_status: "PENDING" })]);
    assert.equal((await commissionOf("40")).data!.status, "awaiting_payment");

    await ingest([order("41", { discount_codes: ["MARIANA"] })]);
    await ingest([order("41", { discount_codes: ["MARIANA"], cancelled_at: new Date().toISOString() })]);
    assert.equal((await commissionOf("41")).data!.status, "reversed");

    // 30-day hold: order 10 (2 days old) is not payable yet.
    const c10 = (await commissionOf("10")).data!;
    const early = await ownerA.rpc("mark_commissions_paid", { p_org: orgA, p_ids: [c10.id] });
    assert.ifError(early.error);
    assert.equal(early.data.paid, 0);

    // Hold 0 days → approved → payable. Analyst cannot pay; B cannot pay A's.
    assert.ifError((await ownerA.rpc("set_commission_hold_days", { p_org: orgA, p_days: 0 })).error);
    const byAnalyst = await analystA.rpc("mark_commissions_paid", { p_org: orgA, p_ids: [c10.id] });
    assert.match(byAnalyst.error?.message ?? "", /FORBIDDEN/);
    const byB = await ownerB.rpc("mark_commissions_paid", { p_org: orgA, p_ids: [c10.id] });
    assert.match(byB.error?.message ?? "", /FORBIDDEN/);
    const paid = await ownerA.rpc("mark_commissions_paid", { p_org: orgA, p_ids: [c10.id] });
    assert.ifError(paid.error);
    assert.equal(paid.data.paid, 1);

    // A refund after payout does not touch the paid commission.
    await ingest([order("10", { discount_codes: ["mariana"], financial_status: "REFUNDED", subtotal: 0 })]);
    const after10 = (await commissionOf("10")).data!;
    assert.equal(after10.status, "paid");
    assert.equal(Number(after10.amount), 20);
  });

  test("import: analyst refused; owner imports, reuses names, skips linked codes, attributes history", async () => {
    await ingest([order("60", { discount_codes: ["DAYANE"] })]);
    const items = [
      { name: "Dayane Pitta", code: "dayane", commission_rate: 12, discount_percent: 10, shopify_discount_id: "gid://shopify/DiscountCodeNode/1", instagram: "@dayane.p" },
      { name: "Outra", code: "ANA", commission_rate: 5 },
    ];
    const bad = await analystA.rpc("import_creator_affiliations", { p_org: orgA, p_items: items });
    assert.match(bad.error?.message ?? "", /FORBIDDEN/);
    const r = await ownerA.rpc("import_creator_affiliations", { p_org: orgA, p_items: items });
    assert.ifError(r.error);
    assert.equal(r.data.imported, 1);
    assert.equal(r.data.skipped, 1, "ANA is already linked");

    const o = (await orderRow("60")).data!;
    assert.ok(o.creator_id, "history re-attributed");
    assert.equal(Number((await commissionOf("60")).data!.amount), 24); // 200 × 12%

    const app = await admin
      .from("applications")
      .select("status, programs(slug, status)")
      .eq("creator_id", o.creator_id!)
      .single();
    assert.equal(app.data!.status, "approved");
    const prog = app.data!.programs as unknown as { slug: string; status: string };
    assert.equal(prog.slug, "influenciadoras-atuais");
    assert.equal(prog.status, "draft", "no public form for the internal program");

    const ig = await admin.from("creator_social_profiles").select("handle_normalized").eq("creator_id", o.creator_id!);
    assert.equal(ig.data![0]?.handle_normalized, "dayane.p");

    // Same name again with a new code reuses nobody (creator already affiliated) → new creator.
    const again = await ownerA.rpc("import_creator_affiliations", {
      p_org: orgA,
      p_items: [{ name: "Mariana", code: "MARI2", commission_rate: 1 }],
    });
    assert.ifError(again.error);
    const mari = await admin.from("creators").select("id").eq("organization_id", orgA).ilike("full_name", "mariana");
    assert.equal(mari.data!.length, 2, "an affiliated creator is never reused");
  });

  test("isolation: org B sees none of A's orders, commissions or affiliations", async () => {
    for (const t of ["shopify_orders", "commissions", "creator_affiliations"]) {
      const r = await ownerB.from(t).select("id").eq("organization_id", orgA);
      assert.equal((r.data ?? []).length, 0, `${t} leaked across tenants`);
    }
    const mine = await analystA.from("commissions").select("id").eq("organization_id", orgA);
    assert.ok((mine.data ?? []).length > 0, "members of A can read A's commissions");
  });

  test("disconnect: secrets cleared, ingest key dead, lookup by domain empty", async () => {
    assert.ifError((await ownerA.rpc("shopify_disconnect", { p_org: orgA })).error);
    const look = await anon().rpc("shopify_connection_secrets", { p_shop_domain: shopA });
    assert.equal(look.data, null);
    const r = await ingest([order("50")]);
    assert.match(r.error?.message ?? "", /FORBIDDEN/);
  });
});
