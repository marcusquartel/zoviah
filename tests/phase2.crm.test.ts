/**
 * Phase 2 — CRM: status machine, timeline, notes, tenant isolation, roles.
 *
 * Real Supabase project. Needs the same env as phase1 plus migration
 * 20260828000001_crm.sql applied. Skips (does not fail) otherwise.
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

let ready = false;
if (configured) {
  const probe = createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const view = await probe.from("application_list_items").select("id").limit(1);
  const fn = await probe.rpc("is_valid_application_transition", {
    p_from: "new",
    p_to: "approved",
  });
  ready = !view.error && !fn.error;
}

const skip = !configured
  ? "Supabase credentials not set"
  : !ready
    ? "Phase 2 schema not applied (run supabase/migrations/20260828000001_crm.sql)"
    : false;

const stamp = Date.now();
const pwd = (p: string) => `${p}1!${stamp}xyz`;

function client(): SupabaseClient {
  return createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const c = client();
  const { error } = await c.auth.signInWithPassword({ email, password });
  assert.ifError(error);
  return c;
}

describe("Phase 2 — CRM", { skip }, () => {
  let admin: SupabaseClient;
  let orgA = "";
  let orgB = "";
  const users: Record<string, { id: string; email: string; password: string }> =
    {};
  const slugA = `p2-a-${stamp}`;
  const slugB = `p2-b-${stamp}`;
  let programAId = "";
  let appId = "";

  async function mkUser(key: string): Promise<void> {
    const email = `p2-${key}-${stamp}@example.test`;
    const password = pwd(key);
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.ifError(error);
    users[key] = { id: data.user!.id, email, password };
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
        { name: "P2 Tenant A", slug: slugA },
        { name: "P2 Tenant B", slug: slugB },
      ])
      .select("id, slug");
    assert.ifError(orgs.error);
    orgA = orgs.data!.find((o) => o.slug === slugA)!.id;
    orgB = orgs.data!.find((o) => o.slug === slugB)!.id;

    await admin.from("organization_members").insert([
      { organization_id: orgA, user_id: users.ownerA.id, role: "owner" },
      { organization_id: orgA, user_id: users.analystA.id, role: "analyst" },
      { organization_id: orgB, user_id: users.ownerB.id, role: "owner" },
    ]);

    const prog = await admin
      .from("programs")
      .insert({
        organization_id: orgA,
        name: "A CRM",
        slug: "creators",
        status: "active",
        form_version: 1,
      })
      .select("id")
      .single();
    assert.ifError(prog.error);
    programAId = prog.data!.id;

    await admin.from("form_fields").insert([
      {
        organization_id: orgA,
        program_id: programAId,
        field_key: "full_name",
        label: "Nome",
        field_type: "text",
        required: true,
        position: 0,
        configuration: { mapping: "full_name" },
      },
      {
        organization_id: orgA,
        program_id: programAId,
        field_key: "email",
        label: "E-mail",
        field_type: "email",
        required: true,
        position: 1,
        configuration: { mapping: "email" },
      },
    ]);

    // A real application via the public RPC (status 'new', possible_duplicate false).
    const sub = await client().rpc("submit_application", {
      p_org_slug: slugA,
      p_program_slug: "creators",
      p_form_version: 1,
      p_answers: { full_name: "Nina Test", email: "nina@example.com" },
      p_field_snapshot: [
        { field_key: "full_name", label: "Nome", field_type: "text" },
      ],
      p_creator: { full_name: "Nina Test", email: "nina@example.com" },
      p_socials: [],
      p_utm: {},
      p_referrer: null,
      p_source: null,
    });
    assert.ifError(sub.error);
    appId = sub.data.application_id;
  });

  after(async () => {
    if (!admin) return;
    await admin.from("applications").delete().in("organization_id", [orgA, orgB]);
    await admin.from("creator_events").delete().in("organization_id", [orgA, orgB]);
    await admin.from("organizations").delete().in("id", [orgA, orgB]);
    for (const u of Object.values(users)) {
      await admin.auth.admin.deleteUser(u.id);
    }
  });

  test("owner A and analyst A see A's applications; B does not", async () => {
    const owner = await signedIn(users.ownerA.email, users.ownerA.password);
    const analyst = await signedIn(users.analystA.email, users.analystA.password);
    const outsider = await signedIn(users.ownerB.email, users.ownerB.password);

    for (const [who, c] of [
      ["owner", owner],
      ["analyst", analyst],
    ] as const) {
      const { data, error } = await c
        .from("application_list_items")
        .select("id")
        .eq("organization_id", orgA);
      assert.ifError(error);
      assert.ok(data!.some((r) => r.id === appId), `${who} should see the app`);
    }

    const leak = await outsider
      .from("application_list_items")
      .select("id")
      .eq("organization_id", orgA);
    assert.ifError(leak.error);
    assert.equal(leak.data!.length, 0, "tenant B must not see A's list");

    const rawLeak = await outsider
      .from("applications")
      .select("id")
      .eq("id", appId);
    assert.equal(rawLeak.data!.length, 0);
  });

  test("tenant B cannot transition A's application", async () => {
    const outsider = await signedIn(users.ownerB.email, users.ownerB.password);
    const { error } = await outsider.rpc("transition_application_status", {
      p_application_id: appId,
      p_to_status: "approved",
    });
    assert.ok(error, "expected FORBIDDEN");
    assert.match(error!.message, /FORBIDDEN/);

    const check = await admin
      .from("applications")
      .select("status")
      .eq("id", appId)
      .single();
    assert.equal(check.data!.status, "new");
  });

  test("analyst A can transition; it writes an audit event with the actor", async () => {
    const analyst = await signedIn(users.analystA.email, users.analystA.password);
    const { data, error } = await analyst.rpc("transition_application_status", {
      p_application_id: appId,
      p_to_status: "awaiting_review",
    });
    assert.ifError(error);
    assert.equal(data.to, "awaiting_review");

    const app = await admin
      .from("applications")
      .select("status")
      .eq("id", appId)
      .single();
    assert.equal(app.data!.status, "awaiting_review");

    const events = await admin
      .from("creator_events")
      .select("type, actor_user_id, data")
      .eq("application_id", appId)
      .eq("type", "application_status_changed")
      .order("created_at", { ascending: false });
    assert.ok(events.data!.length >= 1);
    assert.equal(events.data![0].actor_user_id, users.analystA.id);
    assert.equal(events.data![0].data.from, "new");
    assert.equal(events.data![0].data.to, "awaiting_review");
  });

  test("invalid transition is rejected", async () => {
    const owner = await signedIn(users.ownerA.email, users.ownerA.password);
    // currently awaiting_review; "-> new" is not in the table
    const { error } = await owner.rpc("transition_application_status", {
      p_application_id: appId,
      p_to_status: "new",
    });
    assert.ok(error);
    assert.match(error!.message, /INVALID_TRANSITION/);
  });

  test("approve then archive then reopen; approved_at / archived_at behave", async () => {
    const owner = await signedIn(users.ownerA.email, users.ownerA.password);

    assert.ifError(
      (await owner.rpc("transition_application_status", {
        p_application_id: appId,
        p_to_status: "approved",
      })).error,
    );
    let row = await admin
      .from("applications")
      .select("status, approved_at, archived_at")
      .eq("id", appId)
      .single();
    assert.equal(row.data!.status, "approved");
    assert.ok(row.data!.approved_at);
    assert.equal(row.data!.archived_at, null);

    assert.ifError(
      (await owner.rpc("transition_application_status", {
        p_application_id: appId,
        p_to_status: "archived",
      })).error,
    );
    row = await admin
      .from("applications")
      .select("status, approved_at, archived_at")
      .eq("id", appId)
      .single();
    assert.equal(row.data!.status, "archived");
    assert.ok(row.data!.archived_at, "archived_at set");
    assert.ok(row.data!.approved_at, "approved_at kept");

    assert.ifError(
      (await owner.rpc("transition_application_status", {
        p_application_id: appId,
        p_to_status: "awaiting_review",
      })).error,
    );
    row = await admin
      .from("applications")
      .select("status, archived_at")
      .eq("id", appId)
      .single();
    assert.equal(row.data!.status, "awaiting_review");
    assert.equal(row.data!.archived_at, null, "archived_at cleared on reopen");
  });

  test("add_creator_note: works for own org, blocked cross-tenant", async () => {
    const detail = await admin
      .from("applications")
      .select("creator_id")
      .eq("id", appId)
      .single();
    const creatorId = detail.data!.creator_id;

    const analyst = await signedIn(users.analystA.email, users.analystA.password);
    const ok = await analyst.rpc("add_creator_note", {
      p_creator_id: creatorId,
      p_text: "Bom perfil de skincare.",
      p_application_id: appId,
    });
    assert.ifError(ok.error);

    const note = await admin
      .from("creator_events")
      .select("type, data, actor_user_id")
      .eq("creator_id", creatorId)
      .eq("type", "note_added")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    assert.equal(note.data!.data.text, "Bom perfil de skincare.");
    assert.equal(note.data!.actor_user_id, users.analystA.id);

    const outsider = await signedIn(users.ownerB.email, users.ownerB.password);
    const blocked = await outsider.rpc("add_creator_note", {
      p_creator_id: creatorId,
      p_text: "cross tenant",
    });
    assert.ok(blocked.error, "cross-tenant note must be rejected");
  });

  test("possible_duplicate is preserved through transitions", async () => {
    const conflictApp = await admin
      .from("applications")
      .insert({
        organization_id: orgA,
        program_id: programAId,
        creator_id: (
          await admin
            .from("creators")
            .insert({ organization_id: orgA, full_name: "Dup Person" })
            .select("id")
            .single()
        ).data!.id,
        status: "new",
        form_version: 1,
        possible_duplicate: true,
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    const id = conflictApp.data!.id;

    const owner = await signedIn(users.ownerA.email, users.ownerA.password);
    await owner.rpc("transition_application_status", {
      p_application_id: id,
      p_to_status: "approved",
    });

    const row = await admin
      .from("applications")
      .select("status, possible_duplicate")
      .eq("id", id)
      .single();
    assert.equal(row.data!.status, "approved");
    assert.equal(row.data!.possible_duplicate, true);
  });

  test("Phase 1 data model intact: public submit still yields status 'new'", async () => {
    const sub = await client().rpc("submit_application", {
      p_org_slug: slugA,
      p_program_slug: "creators",
      p_form_version: 1,
      p_answers: { full_name: "Post P2", email: "postp2@example.com" },
      p_field_snapshot: [],
      p_creator: { full_name: "Post P2", email: "postp2@example.com" },
      p_socials: [],
      p_utm: {},
      p_referrer: null,
      p_source: null,
    });
    assert.ifError(sub.error);
    const row = await admin
      .from("applications")
      .select("status")
      .eq("id", sub.data.application_id)
      .single();
    assert.equal(row.data!.status, "new");
  });
});
