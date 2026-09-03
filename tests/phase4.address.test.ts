/**
 * FASE 4 — approval → secure address request → complete profile.
 *
 * Real Supabase. Exercises the RPCs directly (no Claude, no email). Covers the
 * status machine, token hash-only storage, public lookup, completion,
 * idempotency, revoke/regenerate, RLS / cross-tenant / anon. Skips until
 * migration 20260829000002 is applied.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { generateSecureToken, hashToken } from "../src/lib/secure-token.ts";

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
let hasCpf = false;
if (configured) {
  const probe = createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const t = await probe.from("application_requests").select("id").limit(1);
  const f = await probe.rpc("get_public_address_request", {
    p_token_hash: "0".repeat(64),
  });
  ready = !t.error && !f.error;
  const c = await probe.from("creator_addresses").select("cpf").limit(1);
  hasCpf = !c.error;
}
const skipCpf = hasCpf
  ? false
  : "migration 20260901000002_address_cpf_reintroduce.sql not applied";

const skip = !configured
  ? "Supabase credentials not set"
  : !ready
    ? "Phase 4 schema not applied (run supabase/migrations/20260829000002_secure_supplemental_requests.sql)"
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

const GOOD_ADDRESS = {
  recipient_name: "Pâmela Kald",
  cpf: "11144477735",
  postal_code: "30140110",
  street: "Rua dos Aimorés",
  number: "1200",
  complement: "Sala 4",
  neighborhood: "Funcionários",
  city: "Belo Horizonte",
  state: "MG",
  consent: true,
};

describe("Phase 4 — secure address request", { skip }, () => {
  let admin: SupabaseClient;
  let ownerA: SupabaseClient;
  let analystA: SupabaseClient;
  let ownerB: SupabaseClient;
  let orgA = "";
  let orgB = "";
  let programA = "";
  let creatorA = "";
  let appApproved = "";
  const users: Record<string, { id: string; email: string; password: string }> =
    {};

  async function mkUser(key: string) {
    const email = `p4-${key}-${stamp}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: pwd(key),
      email_confirm: true,
    });
    assert.ifError(error);
    users[key] = { id: data.user!.id, email, password: pwd(key) };
  }

  async function seedApprovedApplication(): Promise<string> {
    const creator = await admin
      .from("creators")
      .insert({ organization_id: orgA, full_name: "Creator P4" })
      .select("id")
      .single();
    const app = await admin
      .from("applications")
      .insert({
        organization_id: orgA,
        program_id: programA,
        creator_id: creator.data!.id,
        status: "approved",
        approved_at: new Date().toISOString(),
        form_version: 1,
      })
      .select("id, creator_id")
      .single();
    creatorA = app.data!.creator_id;
    return app.data!.id;
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
        { name: "P4 A", slug: `p4-a-${stamp}` },
        { name: "P4 B", slug: `p4-b-${stamp}` },
      ])
      .select("id, slug");
    assert.ifError(orgs.error);
    orgA = orgs.data!.find((o) => o.slug === `p4-a-${stamp}`)!.id;
    orgB = orgs.data!.find((o) => o.slug === `p4-b-${stamp}`)!.id;

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

    appApproved = await seedApprovedApplication();

    ownerA = await signedIn(users.ownerA.email, users.ownerA.password);
    analystA = await signedIn(users.analystA.email, users.analystA.password);
    ownerB = await signedIn(users.ownerB.email, users.ownerB.password);
  });

  after(async () => {
    if (!admin) return;
    await admin.from("creator_addresses").delete().in("organization_id", [orgA, orgB]);
    await admin.from("application_requests").delete().in("organization_id", [orgA, orgB]);
    await admin.from("creator_analyses").delete().in("organization_id", [orgA, orgB]);
    await admin.from("applications").delete().in("organization_id", [orgA, orgB]);
    await admin.from("creator_events").delete().in("organization_id", [orgA, orgB]);
    await admin.from("creators").delete().in("organization_id", [orgA, orgB]);
    await admin.from("organizations").delete().in("id", [orgA, orgB]);
    for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
  });

  test("1/2/3) create_address_request: approved → awaiting_address, approved_at kept, hash stored not raw", async () => {
    const raw = generateSecureToken();
    const before = await admin
      .from("applications")
      .select("approved_at")
      .eq("id", appApproved)
      .single();

    const res = await ownerA.rpc("create_address_request", {
      p_application_id: appApproved,
      p_token_hash: hashToken(raw),
    });
    assert.ifError(res.error);
    assert.equal(res.data.ok, true);

    const app = await admin
      .from("applications")
      .select("status, approved_at")
      .eq("id", appApproved)
      .single();
    assert.equal(app.data!.status, "awaiting_address");
    assert.equal(app.data!.approved_at, before.data!.approved_at); // §9

    const row = await admin
      .from("application_requests")
      .select("*")
      .eq("id", res.data.request_id)
      .single();
    assert.equal(row.data!.status, "pending");
    assert.equal(row.data!.token_hash, hashToken(raw));
    // §84: the raw token is nowhere in the row.
    const asText = JSON.stringify(row.data);
    assert.ok(!asText.includes(raw), "raw token leaked into the request row");

    // §85: nor in any event.
    const events = await admin
      .from("creator_events")
      .select("type, data")
      .eq("application_id", appApproved);
    const evText = JSON.stringify(events.data);
    assert.ok(!evText.includes(raw), "raw token leaked into an event");
    assert.ok(
      events.data!.some((e) => e.type === "address_request_created"),
      "timeline event written",
    );
  });

  test("4) analyst (any member role) can also generate", async () => {
    const app2 = await seedApprovedApplication();
    const res = await analystA.rpc("create_address_request", {
      p_application_id: app2,
      p_token_hash: hashToken(generateSecureToken()),
    });
    assert.ifError(res.error);
    await admin.from("applications").delete().eq("id", app2);
  });

  test("5) org B cannot create a request for org A's application", async () => {
    const app3 = await seedApprovedApplication();
    const res = await ownerB.rpc("create_address_request", {
      p_application_id: app3,
      p_token_hash: hashToken(generateSecureToken()),
    });
    assert.ok(res.error);
    assert.match(res.error!.message, /FORBIDDEN/);
    await admin.from("applications").delete().eq("id", app3);
  });

  test("6/7) public lookup: valid pending returns branding only; garbage returns invalid", async () => {
    const raw = generateSecureToken();
    const app = await seedApprovedApplication();
    await ownerA.rpc("create_address_request", {
      p_application_id: app,
      p_token_hash: hashToken(raw),
    });

    const ok = await anon().rpc("get_public_address_request", {
      p_token_hash: hashToken(raw),
    });
    assert.ifError(ok.error);
    assert.equal(ok.data.status, "pending");
    assert.ok(ok.data.organization?.name);
    assert.equal(ok.data.program_name, "A");
    // no PII
    const j = JSON.stringify(ok.data);
    assert.ok(!j.includes("Creator P4"));
    assert.ok(!j.toLowerCase().includes("email"));

    const bad = await anon().rpc("get_public_address_request", {
      p_token_hash: hashToken("nope"),
    });
    assert.equal(bad.data.status, "invalid");

    await admin.from("application_requests").delete().eq("application_id", app);
    await admin.from("applications").delete().eq("id", app);
  });

  test("8) expired token cannot complete and does not change the application", async () => {
    const raw = generateSecureToken();
    const app = await seedApprovedApplication();
    const r = await ownerA.rpc("create_address_request", {
      p_application_id: app,
      p_token_hash: hashToken(raw),
    });
    await admin
      .from("application_requests")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", r.data.request_id);

    const done = await anon().rpc("complete_address_request", {
      p_token_hash: hashToken(raw),
      p_payload: GOOD_ADDRESS,
    });
    assert.ok(done.error);
    assert.match(done.error!.message, /INVALID_LINK/);

    const app2 = await admin
      .from("applications")
      .select("status")
      .eq("id", app)
      .single();
    assert.equal(app2.data!.status, "awaiting_address"); // unchanged
    const addr = await admin
      .from("creator_addresses")
      .select("id")
      .eq("organization_id", orgA)
      .eq("creator_id", creatorA);
    assert.equal(addr.data!.length, 0);

    await admin.from("application_requests").delete().eq("application_id", app);
    await admin.from("applications").delete().eq("id", app);
  });

  test("9/10) regenerate revokes the old token; only the new one works", async () => {
    const rawOld = generateSecureToken();
    const app = await seedApprovedApplication();
    await ownerA.rpc("create_address_request", {
      p_application_id: app,
      p_token_hash: hashToken(rawOld),
    });
    const rawNew = generateSecureToken();
    const regen = await ownerA.rpc("regenerate_address_request", {
      p_application_id: app,
      p_token_hash: hashToken(rawNew),
    });
    assert.ifError(regen.error);

    const oldLook = await anon().rpc("get_public_address_request", {
      p_token_hash: hashToken(rawOld),
    });
    assert.equal(oldLook.data.status, "invalid"); // revoked
    const newLook = await anon().rpc("get_public_address_request", {
      p_token_hash: hashToken(rawNew),
    });
    assert.equal(newLook.data.status, "pending");

    // application stays awaiting_address the whole time (no artificial bounce)
    const st = await admin
      .from("applications")
      .select("status")
      .eq("id", app)
      .single();
    assert.equal(st.data!.status, "awaiting_address");

    const oldComplete = await anon().rpc("complete_address_request", {
      p_token_hash: hashToken(rawOld),
      p_payload: GOOD_ADDRESS,
    });
    assert.ok(oldComplete.error);

    await admin.from("application_requests").delete().eq("application_id", app);
    await admin.from("applications").delete().eq("id", app);
  });

  test("11-18) completion: address current, request completed, application completed, consent_at, idempotent", async () => {
    const raw = generateSecureToken();
    const app = await seedApprovedApplication();
    const r = await ownerA.rpc("create_address_request", {
      p_application_id: app,
      p_token_hash: hashToken(raw),
    });
    const requestId = r.data.request_id;

    const done = await anon().rpc("complete_address_request", {
      p_token_hash: hashToken(raw),
      p_payload: GOOD_ADDRESS,
    });
    assert.ifError(done.error);
    assert.equal(done.data.status, "completed");

    const addr = await admin
      .from("creator_addresses")
      .select("*")
      .eq("organization_id", orgA)
      .eq("creator_id", creatorA);
    assert.equal(addr.data!.length, 1);
    assert.equal(addr.data![0].is_current, true);
    assert.equal(addr.data![0].postal_code, "30140110");
    assert.equal(addr.data![0].state, "MG");
    assert.equal(addr.data![0].source_request_id, requestId);

    const req = await admin
      .from("application_requests")
      .select("status, completed_at, consent_at")
      .eq("id", requestId)
      .single();
    assert.equal(req.data!.status, "completed");
    assert.ok(req.data!.completed_at);
    assert.ok(req.data!.consent_at); // §17/§31

    const appRow = await admin
      .from("applications")
      .select("status, approved_at")
      .eq("id", app)
      .single();
    assert.equal(appRow.data!.status, "completed");
    assert.ok(appRow.data!.approved_at); // §9 preserved

    // §17: event carries no address / token
    const events = await admin
      .from("creator_events")
      .select("type, data, actor_user_id")
      .eq("application_id", app);
    const submitted = events.data!.find((e) => e.type === "address_submitted")!;
    assert.ok(submitted);
    assert.equal(submitted.actor_user_id, null); // §58 public
    const evText = JSON.stringify(events.data);
    for (const s of ["Aimorés", "30140110", "Pâmela", raw]) {
      assert.ok(!evText.includes(s), `event leaked "${s}"`);
    }

    // §37/§96: a double-submit is idempotent — still exactly one address.
    const again = await anon().rpc("complete_address_request", {
      p_token_hash: hashToken(raw),
      p_payload: { ...GOOD_ADDRESS, street: "Rua Diferente" },
    });
    assert.ifError(again.error);
    assert.equal(again.data.status, "already_completed");
    const addr2 = await admin
      .from("creator_addresses")
      .select("id, street")
      .eq("creator_id", creatorA);
    assert.equal(addr2.data!.length, 1);
    assert.equal(addr2.data![0].street, "Rua dos Aimorés"); // unchanged

    // §19/§20: org B cannot read the address or the request; anon reads nothing.
    const bAddr = await ownerB
      .from("creator_addresses")
      .select("id")
      .eq("creator_id", creatorA);
    assert.equal((bAddr.data ?? []).length, 0);
    const bReq = await ownerB
      .from("application_requests")
      .select("id")
      .eq("application_id", app);
    assert.equal((bReq.data ?? []).length, 0);
    const anonAddr = await anon().from("creator_addresses").select("id");
    assert.ok(anonAddr.error || (anonAddr.data ?? []).length === 0);
    const anonReq = await anon().from("application_requests").select("id");
    assert.ok(anonReq.error || (anonReq.data ?? []).length === 0);
  });

  test("completed public lookup says 'completed', no address", async () => {
    const raw = generateSecureToken();
    const app = await seedApprovedApplication();
    await ownerA.rpc("create_address_request", {
      p_application_id: app,
      p_token_hash: hashToken(raw),
    });
    await anon().rpc("complete_address_request", {
      p_token_hash: hashToken(raw),
      p_payload: GOOD_ADDRESS,
    });
    const look = await anon().rpc("get_public_address_request", {
      p_token_hash: hashToken(raw),
    });
    assert.equal(look.data.status, "completed");
    assert.ok(!JSON.stringify(look.data).includes("Aimorés"));

    await admin.from("creator_addresses").delete().eq("creator_id", app);
    await admin.from("application_requests").delete().eq("application_id", app);
    await admin.from("applications").delete().eq("id", app);
  });

  test("22/23) revoke → back to approved, approved_at preserved, token dead", async () => {
    const raw = generateSecureToken();
    const app = await seedApprovedApplication();
    const before = await admin
      .from("applications")
      .select("approved_at")
      .eq("id", app)
      .single();
    await ownerA.rpc("create_address_request", {
      p_application_id: app,
      p_token_hash: hashToken(raw),
    });
    const rev = await ownerA.rpc("revoke_address_request", {
      p_application_id: app,
    });
    assert.ifError(rev.error);

    const appRow = await admin
      .from("applications")
      .select("status, approved_at")
      .eq("id", app)
      .single();
    assert.equal(appRow.data!.status, "approved");
    assert.equal(appRow.data!.approved_at, before.data!.approved_at);

    const look = await anon().rpc("get_public_address_request", {
      p_token_hash: hashToken(raw),
    });
    assert.equal(look.data.status, "invalid");

    await admin.from("application_requests").delete().eq("application_id", app);
    await admin.from("applications").delete().eq("id", app);
  });

  test("89) manual transition_application_status refuses the secure-only edges", async () => {
    const app = await seedApprovedApplication();
    const bad1 = await ownerA.rpc("transition_application_status", {
      p_application_id: app,
      p_to_status: "awaiting_address",
    });
    assert.ok(bad1.error);
    assert.match(bad1.error!.message, /USE_ADDRESS_REQUEST_FLOW/);

    // put it into awaiting_address via the real flow, then try the manual jump
    await ownerA.rpc("create_address_request", {
      p_application_id: app,
      p_token_hash: hashToken(generateSecureToken()),
    });
    const bad2 = await ownerA.rpc("transition_application_status", {
      p_application_id: app,
      p_to_status: "completed",
    });
    assert.ok(bad2.error);
    assert.match(bad2.error!.message, /USE_ADDRESS_REQUEST_FLOW/);
    const bad3 = await ownerA.rpc("transition_application_status", {
      p_application_id: app,
      p_to_status: "approved",
    });
    assert.ok(bad3.error);
    assert.match(bad3.error!.message, /USE_ADDRESS_REQUEST_FLOW/);

    await admin.from("application_requests").delete().eq("application_id", app);
    await admin.from("applications").delete().eq("id", app);
  });

  test("complete_address_request refuses a malformed address (INVALID_ADDRESS)", async () => {
    const raw = generateSecureToken();
    const app = await seedApprovedApplication();
    await ownerA.rpc("create_address_request", {
      p_application_id: app,
      p_token_hash: hashToken(raw),
    });
    const bad = await anon().rpc("complete_address_request", {
      p_token_hash: hashToken(raw),
      p_payload: { ...GOOD_ADDRESS, postal_code: "123" }, // not 8 digits
    });
    assert.ok(bad.error);
    assert.match(bad.error!.message, /INVALID_ADDRESS/);
    const st = await admin
      .from("applications")
      .select("status")
      .eq("id", app)
      .single();
    assert.equal(st.data!.status, "awaiting_address"); // unchanged

    await admin.from("application_requests").delete().eq("application_id", app);
    await admin.from("applications").delete().eq("id", app);
  });

  test("create_address_request refuses a non-approved application", async () => {
    const creator = await admin
      .from("creators")
      .insert({ organization_id: orgA, full_name: "Not approved" })
      .select("id")
      .single();
    const app = await admin
      .from("applications")
      .insert({
        organization_id: orgA,
        program_id: programA,
        creator_id: creator.data!.id,
        status: "awaiting_review",
        form_version: 1,
      })
      .select("id")
      .single();
    const res = await ownerA.rpc("create_address_request", {
      p_application_id: app.data!.id,
      p_token_hash: hashToken(generateSecureToken()),
    });
    assert.ok(res.error);
    assert.match(res.error!.message, /APPLICATION_NOT_APPROVED/);
    await admin.from("applications").delete().eq("id", app.data!.id);
    await admin.from("creators").delete().eq("id", creator.data!.id);
  });

  test("CPF: required, stored digits-only, never in the timeline event", { skip: skipCpf }, async () => {
    const raw = generateSecureToken();
    const app = await seedApprovedApplication();
    await ownerA.rpc("create_address_request", {
      p_application_id: app,
      p_token_hash: hashToken(raw),
    });

    // a bad CPF is rejected and nothing is written
    const bad = await anon().rpc("complete_address_request", {
      p_token_hash: hashToken(raw),
      p_payload: { ...GOOD_ADDRESS, cpf: "111.444.777-00" },
    });
    assert.ok(bad.error);
    assert.match(bad.error!.message, /INVALID_ADDRESS/);

    // a masked, valid CPF is accepted and normalised to digits
    const ok = await anon().rpc("complete_address_request", {
      p_token_hash: hashToken(raw),
      p_payload: { ...GOOD_ADDRESS, cpf: "111.444.777-35" },
    });
    assert.ifError(ok.error);
    assert.equal(ok.data.status, "completed");

    const addr = await admin
      .from("creator_addresses")
      .select("cpf")
      .eq("creator_id", creatorA)
      .eq("is_current", true)
      .single();
    assert.equal(addr.data!.cpf, "11144477735");

    const events = await admin
      .from("creator_events")
      .select("data")
      .eq("application_id", app);
    const evText = JSON.stringify(events.data);
    assert.ok(!evText.includes("11144477735")); // digits-only CPF
    assert.ok(!evText.includes("111.444.777-35")); // masked CPF

    await admin.from("creator_addresses").delete().eq("creator_id", creatorA);
    await admin.from("application_requests").delete().eq("application_id", app);
    await admin.from("applications").delete().eq("id", app);
  });
});
