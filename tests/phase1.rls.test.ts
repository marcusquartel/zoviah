/**
 * Phase 1 — tenant isolation + public submission flow, end to end against a
 * real Supabase project.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY in .env.local, AND migrations
 * 20260827000003/4/5 applied. The suite skips (does not fail) when any of
 * those is missing.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
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

let schemaReady = false;
if (configured) {
  const probe = createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await probe.from("programs").select("id").limit(1);
  schemaReady = !error;
}

const skip = !configured
  ? "Supabase credentials not set"
  : !schemaReady
    ? "Phase 1 schema not applied (run supabase/migrations/20260827000003..5)"
    : false;

const stamp = Date.now();

function anon(): SupabaseClient {
  return createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe("Phase 1 — programs, forms, public submission", { skip }, () => {
  let admin: SupabaseClient;
  let orgA = "";
  let orgB = "";
  let userA = "";
  let userB = "";
  const slugA = `p1-a-${stamp}`;
  const slugB = `p1-b-${stamp}`;
  const progA = "creators";
  const progB = "creators";

  before(async () => {
    admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const a = await admin.auth.admin.createUser({
      email: `p1-a-${stamp}@example.test`,
      password: `Aa1!${stamp}xyz`,
      email_confirm: true,
    });
    assert.ifError(a.error);
    userA = a.data.user!.id;
    const b = await admin.auth.admin.createUser({
      email: `p1-b-${stamp}@example.test`,
      password: `Bb1!${stamp}xyz`,
      email_confirm: true,
    });
    assert.ifError(b.error);
    userB = b.data.user!.id;

    const orgs = await admin
      .from("organizations")
      .insert([
        { name: "P1 Tenant A", slug: slugA },
        { name: "P1 Tenant B", slug: slugB },
      ])
      .select("id, slug");
    assert.ifError(orgs.error);
    orgA = orgs.data!.find((o) => o.slug === slugA)!.id;
    orgB = orgs.data!.find((o) => o.slug === slugB)!.id;

    await admin.from("organization_members").insert([
      { organization_id: orgA, user_id: userA, role: "owner" },
      { organization_id: orgB, user_id: userB, role: "owner" },
    ]);

    // Programs: A active, B active. Plus a draft program in A.
    const programs = await admin
      .from("programs")
      .insert([
        {
          organization_id: orgA,
          name: "A Creators",
          slug: progA,
          status: "active",
          form_version: 3,
          success_message: "Obrigado!",
        },
        {
          organization_id: orgB,
          name: "B Creators",
          slug: progB,
          status: "active",
          form_version: 1,
        },
        {
          organization_id: orgA,
          name: "A Draft",
          slug: `draft-${stamp}`,
          status: "draft",
          form_version: 1,
        },
      ])
      .select("id, slug, organization_id");
    assert.ifError(programs.error);
    const progAId = programs.data!.find(
      (p) => p.slug === progA && p.organization_id === orgA,
    )!.id;

    const fields = [
      { field_key: "full_name", label: "Nome", field_type: "text", required: true, position: 0, configuration: { mapping: "full_name" } },
      { field_key: "email", label: "E-mail", field_type: "email", required: true, position: 1, configuration: { mapping: "email" } },
      { field_key: "whatsapp", label: "WhatsApp", field_type: "phone", required: false, position: 2, configuration: { mapping: "phone" } },
      { field_key: "instagram", label: "Instagram", field_type: "instagram", required: false, position: 3, configuration: {} },
      { field_key: "tiktok", label: "TikTok", field_type: "tiktok", required: false, position: 4, configuration: {} },
      { field_key: "topics", label: "Assuntos", field_type: "text", required: false, position: 5, configuration: {} },
    ].map((f) => ({ ...f, organization_id: orgA, program_id: progAId }));
    const fieldsRes = await admin.from("form_fields").insert(fields);
    assert.ifError(fieldsRes.error);
  });

  after(async () => {
    if (!admin) return;
    await admin.from("applications").delete().in("organization_id", [orgA, orgB]);
    await admin.from("creator_events").delete().in("organization_id", [orgA, orgB]);
    await admin.from("organizations").delete().in("id", [orgA, orgB]);
    if (userA) await admin.auth.admin.deleteUser(userA);
    if (userB) await admin.auth.admin.deleteUser(userB);
  });

  // ---- RLS isolation ----------------------------------------------------
  test("tenant B cannot read tenant A's programs / fields / creators / applications", async () => {
    const b = anon();
    await b.auth.signInWithPassword({
      email: `p1-b-${stamp}@example.test`,
      password: `Bb1!${stamp}xyz`,
    });

    for (const table of [
      "programs",
      "form_fields",
      "creators",
      "creator_social_profiles",
      "applications",
    ]) {
      const { data, error } = await b
        .from(table)
        .select("id")
        .eq("organization_id", orgA);
      assert.ifError(error);
      assert.equal(data!.length, 0, `${table} leaked to tenant B`);
    }
  });

  test("tenant B cannot insert a program into tenant A", async () => {
    const b = anon();
    await b.auth.signInWithPassword({
      email: `p1-b-${stamp}@example.test`,
      password: `Bb1!${stamp}xyz`,
    });
    const { error } = await b
      .from("programs")
      .insert({ organization_id: orgA, name: "x", slug: `x-${stamp}` });
    assert.ok(error, "expected RLS to reject cross-tenant program insert");
  });

  // ---- get_public_program --------------------------------------------------
  test("get_public_program: active returns fields, draft returns null", async () => {
    const pub = anon();
    const active = await pub.rpc("get_public_program", {
      p_org_slug: slugA,
      p_program_slug: progA,
    });
    assert.ifError(active.error);
    assert.ok(active.data, "active program should be returned");
    assert.equal(active.data.program.status, "active");
    assert.equal(active.data.program.form_version, 3);
    assert.ok(Array.isArray(active.data.fields));
    assert.equal(active.data.fields.length, 6);

    const draft = await pub.rpc("get_public_program", {
      p_org_slug: slugA,
      p_program_slug: `draft-${stamp}`,
    });
    assert.ifError(draft.error);
    assert.equal(draft.data, null);
  });

  // ---- submission --------------------------------------------------------
  async function submit(over: Record<string, unknown> = {}) {
    const pub = anon();
    return pub.rpc("submit_application", {
      p_org_slug: slugA,
      p_program_slug: progA,
      p_form_version: 3,
      p_answers: { topics: "beleza" },
      p_field_snapshot: [{ field_key: "full_name", label: "Nome", field_type: "text" }],
      p_creator: { full_name: "Ana Souza", email: "ana@example.com" },
      p_socials: [],
      p_utm: {},
      p_referrer: null,
      p_source: null,
      ...over,
    });
  }

  test("new person -> creator + application + social + event; UTMs stored", async () => {
    const res = await submit({
      p_creator: { full_name: "Bea Lima", email: "BEA@Example.com" },
      p_socials: [
        {
          platform: "instagram",
          handle: "@Bea.Lima",
          handle_normalized: "bea.lima",
          profile_url: "https://instagram.com/bea.lima",
        },
      ],
      p_utm: { source: "instagram", medium: "bio", campaign: "verao" },
      p_referrer: "https://instagram.com/",
    });
    assert.ifError(res.error);
    assert.equal(res.data.ok, true);
    assert.equal(res.data.possible_duplicate, false);

    const creator = await admin
      .from("creators")
      .select("id, email, full_name")
      .eq("id", res.data.creator_id)
      .single();
    assert.equal(creator.data!.email, "bea@example.com"); // normalized by RPC caller? stored as given

    const app = await admin
      .from("applications")
      .select("utm_source, utm_campaign, form_version, status, answers")
      .eq("id", res.data.application_id)
      .single();
    assert.equal(app.data!.utm_source, "instagram");
    assert.equal(app.data!.utm_campaign, "verao");
    assert.equal(app.data!.form_version, 3);
    assert.equal(app.data!.status, "new");

    const social = await admin
      .from("creator_social_profiles")
      .select("handle_normalized, platform")
      .eq("creator_id", res.data.creator_id);
    assert.equal(social.data!.length, 1);
    assert.equal(social.data![0].handle_normalized, "bea.lima");

    const events = await admin
      .from("creator_events")
      .select("type")
      .eq("creator_id", res.data.creator_id);
    assert.ok(events.data!.some((e) => e.type === "application_submitted"));
  });

  test("same instagram -> reuses creator, new application", async () => {
    const first = await submit({
      p_creator: { full_name: "Cida Rocha", email: "cida@example.com" },
      p_socials: [
        { platform: "instagram", handle: "cida", handle_normalized: "cida" },
      ],
    });
    const second = await submit({
      p_creator: { full_name: "Cida R.", email: "outra@example.com" },
      p_socials: [
        { platform: "instagram", handle: "@CIDA", handle_normalized: "cida" },
      ],
    });
    assert.equal(first.data.creator_id, second.data.creator_id);

    const apps = await admin
      .from("applications")
      .select("id")
      .eq("creator_id", first.data.creator_id);
    assert.equal(apps.data!.length, 2);
  });

  test("email-only match reuses the creator", async () => {
    const first = await submit({
      p_creator: { full_name: "Dora M", email: "dora@example.com" },
      p_socials: [],
    });
    const second = await submit({
      p_creator: { full_name: "Dora Menezes", email: "Dora@example.com" },
      p_socials: [],
    });
    assert.equal(first.data.creator_id, second.data.creator_id);
  });

  test("phone-only match does NOT merge — new creator, flagged possible_duplicate", async () => {
    // Two different people who happen to share a WhatsApp number.
    const first = await submit({
      p_creator: {
        full_name: "Fatima Alves",
        email: "fatima@example.com",
        phone_e164: "+5511955550000",
      },
      p_socials: [],
    });
    const second = await submit({
      p_creator: {
        full_name: "Gustavo Reis",
        email: "gustavo@example.com",
        phone_e164: "+5511955550000",
      },
      p_socials: [
        { platform: "instagram", handle: "gustavoreis", handle_normalized: "gustavoreis" },
      ],
    });
    assert.notEqual(second.data.creator_id, first.data.creator_id);
    assert.equal(second.data.possible_duplicate, true);

    const created = await admin
      .from("creators")
      .select("full_name")
      .eq("id", second.data.creator_id)
      .single();
    assert.equal(created.data!.full_name, "Gustavo Reis"); // own name kept
  });

  test("conflicting identity -> possible_duplicate, no destructive merge", async () => {
    const c1 = await submit({
      p_creator: { full_name: "Eva One", email: "eva1@example.com" },
      p_socials: [
        { platform: "instagram", handle: "evaig", handle_normalized: "evaig" },
      ],
    });
    const c2 = await submit({
      p_creator: {
        full_name: "Eva Two",
        email: "eva2@example.com",
        phone_e164: "+5511911112222",
      },
      p_socials: [
        { platform: "tiktok", handle: "evatt", handle_normalized: "evatt" },
      ],
    });
    assert.notEqual(c1.data.creator_id, c2.data.creator_id);

    // Now a submission whose instagram points at c1 and phone points at c2.
    const conflict = await submit({
      p_creator: {
        full_name: "Eva ?",
        email: "eva3@example.com",
        phone_e164: "+5511911112222",
      },
      p_socials: [
        { platform: "instagram", handle: "evaig", handle_normalized: "evaig" },
      ],
    });
    assert.equal(conflict.data.possible_duplicate, true);
    // instagram has priority -> attached to c1, nothing merged into/out of c2
    assert.equal(conflict.data.creator_id, c1.data.creator_id);
    const c2Still = await admin
      .from("creators")
      .select("phone_e164")
      .eq("id", c2.data.creator_id)
      .single();
    assert.equal(c2Still.data!.phone_e164, "+5511911112222");
  });

  test("dedup does not cross organizations", async () => {
    // Seed a creator in org B with handle "shared" via the service role.
    const bCreator = await admin
      .from("creators")
      .insert({ organization_id: orgB, full_name: "B Person" })
      .select("id")
      .single();
    await admin.from("creator_social_profiles").insert({
      organization_id: orgB,
      creator_id: bCreator.data!.id,
      platform: "instagram",
      handle: "shared",
      handle_normalized: "shared",
    });

    const res = await submit({
      p_creator: { full_name: "A Person", email: "aperson@example.com" },
      p_socials: [
        { platform: "instagram", handle: "shared", handle_normalized: "shared" },
      ],
    });
    assert.ifError(res.error);
    assert.notEqual(res.data.creator_id, bCreator.data!.id);
    const created = await admin
      .from("creators")
      .select("organization_id")
      .eq("id", res.data.creator_id)
      .single();
    assert.equal(created.data!.organization_id, orgA);
  });

  test("inactive program is rejected and leaves no orphan records", async () => {
    const before = await admin
      .from("creators")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgA);

    const pub = anon();
    const res = await pub.rpc("submit_application", {
      p_org_slug: slugA,
      p_program_slug: `draft-${stamp}`,
      p_form_version: 1,
      p_answers: {},
      p_field_snapshot: [],
      p_creator: { full_name: "Should Not Exist", email: "nope@example.com" },
      p_socials: [
        { platform: "instagram", handle: "nope", handle_normalized: "nopehandle" },
      ],
      p_utm: {},
      p_referrer: null,
      p_source: null,
    });
    assert.ok(res.error, "submission to a draft program must fail");

    const afterCount = await admin
      .from("creators")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgA);
    assert.equal(afterCount.count, before.count, "no orphan creator was created");

    const orphanSocial = await admin
      .from("creator_social_profiles")
      .select("id")
      .eq("organization_id", orgA)
      .eq("handle_normalized", "nopehandle");
    assert.equal(orphanSocial.data!.length, 0);
  });

  test("tenant A owner CAN read their own applications", async () => {
    const a = anon();
    await a.auth.signInWithPassword({
      email: `p1-a-${stamp}@example.test`,
      password: `Aa1!${stamp}xyz`,
    });
    const { data, error } = await a
      .from("applications")
      .select("id")
      .eq("organization_id", orgA);
    assert.ifError(error);
    assert.ok(data!.length > 0, "owner should see their submissions");
  });
});
