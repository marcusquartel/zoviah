/**
 * Shipping address: collected at signup (submit_application p_address), with
 * the secure address link as a status-independent fallback.
 *
 * Real Supabase. Exercises the RPCs directly (no email). Covers signup
 * address capture, token hash-only storage, public lookup, completion,
 * idempotency, revoke/regenerate, RLS / cross-tenant / anon. Skips until
 * migration 20260906000001 is applied.
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
if (configured) {
  const probe = createClient(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const t = await probe.from("application_requests").select("id").limit(1);
  const f = await probe.rpc("get_public_address_request", {
    p_token_hash: "0".repeat(64),
  });
  ready = !t.error && !f.error;
  // creator_addresses.source arrives with 20260906000001 (address at signup).
  const c = await probe.from("creator_addresses").select("source").limit(1);
  ready = ready && !c.error;
}

const skip = !configured
  ? "Supabase credentials not set"
  : !ready
    ? "Address schema not applied (run supabase/migrations/20260906000001_address_at_signup_drop_ai.sql)"
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

/** The signup form's p_address (no recipient / consent: SQL uses the name). */
const SIGNUP_ADDRESS = {
  cpf: "111.444.777-35",
  postal_code: "30140-110",
  street: "Rua dos Aimorés",
  number: "1200",
  complement: null,
  neighborhood: "Funcionários",
  city: "Belo Horizonte",
  state: "mg",
};

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
    await admin.from("applications").delete().in("organization_id", [orgA, orgB]);
    await admin.from("creator_events").delete().in("organization_id", [orgA, orgB]);
    await admin.from("creators").delete().in("organization_id", [orgA, orgB]);
    await admin.from("organizations").delete().in("id", [orgA, orgB]);
    for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
  });

  test("1/2/3) create_address_request: status untouched, approved_at kept, hash stored not raw", async () => {
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
    assert.equal(app.data!.status, "approved");
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
    assert.equal(app2.data!.status, "approved"); // unchanged
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

    // the link never moves the application
    const st = await admin
      .from("applications")
      .select("status")
      .eq("id", app)
      .single();
    assert.equal(st.data!.status, "approved");

    const oldComplete = await anon().rpc("complete_address_request", {
      p_token_hash: hashToken(rawOld),
      p_payload: GOOD_ADDRESS,
    });
    assert.ok(oldComplete.error);

    await admin.from("application_requests").delete().eq("application_id", app);
    await admin.from("applications").delete().eq("id", app);
  });

  test("11-18) completion: address current, request completed, application untouched, consent_at, idempotent", async () => {
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
    assert.equal(addr.data![0].source, "secure_request");

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
    assert.equal(appRow.data!.status, "approved");
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

  test("22/23) revoke: status and approved_at untouched, token dead", async () => {
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

  test("89) the removed address-step statuses are not reachable", async () => {
    const app = await seedApprovedApplication();
    for (const to of ["awaiting_address", "completed"]) {
      const bad = await ownerA.rpc("transition_application_status", {
        p_application_id: app,
        p_to_status: to,
      });
      assert.ok(bad.error, `${to} must be refused`);
      assert.match(bad.error!.message, /INVALID_TRANSITION/);
    }
    await admin.from("applications").delete().eq("id", app);
  });

  test("archiving revokes a pending link", async () => {
    const raw = generateSecureToken();
    const app = await seedApprovedApplication();
    await ownerA.rpc("create_address_request", {
      p_application_id: app,
      p_token_hash: hashToken(raw),
    });
    const arch = await ownerA.rpc("transition_application_status", {
      p_application_id: app,
      p_to_status: "archived",
    });
    assert.ifError(arch.error);
    const look = await anon().rpc("get_public_address_request", {
      p_token_hash: hashToken(raw),
    });
    assert.equal(look.data.status, "invalid");

    // an archived application cannot get a new link
    const again = await ownerA.rpc("create_address_request", {
      p_application_id: app,
      p_token_hash: hashToken(generateSecureToken()),
    });
    assert.ok(again.error);
    assert.match(again.error!.message, /APPLICATION_ARCHIVED/);

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
    assert.equal(st.data!.status, "approved"); // unchanged

    await admin.from("application_requests").delete().eq("application_id", app);
    await admin.from("applications").delete().eq("id", app);
  });

  test("create_address_request works before approval; a second pending one is refused", async () => {
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
    assert.ifError(res.error);

    const dup = await ownerA.rpc("create_address_request", {
      p_application_id: app.data!.id,
      p_token_hash: hashToken(generateSecureToken()),
    });
    assert.ok(dup.error);
    assert.match(dup.error!.message, /REQUEST_ALREADY_PENDING/);

    await admin.from("application_requests").delete().eq("application_id", app.data!.id);
    await admin.from("applications").delete().eq("id", app.data!.id);
    await admin.from("creators").delete().eq("id", creator.data!.id);
  });

  test("CPF: required, stored digits-only, never in the timeline event", async () => {
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

  // ---- address at signup ------------------------------------------------
  function submit(over: Record<string, unknown> = {}, client = anon()) {
    return client.rpc("submit_application", {
      p_org_slug: `p4-a-${stamp}`,
      p_program_slug: "creators",
      p_form_version: 1,
      p_answers: {},
      p_field_snapshot: [],
      p_creator: { full_name: "Signup Creator", email: `signup-${stamp}@example.test` },
      p_socials: [],
      p_utm: {},
      p_referrer: null,
      p_source: null,
      p_address: SIGNUP_ADDRESS,
      ...over,
    });
  }

  test("signup: an anonymous submission must carry an address", async () => {
    const res = await submit({
      p_address: null,
      p_creator: { full_name: "No Address", email: `noaddr-${stamp}@example.test` },
    });
    assert.ok(res.error);
    assert.match(res.error!.message, /ADDRESS_REQUIRED/);
  });

  test("signup: a bad CPF is refused and nothing is written", async () => {
    const email = `badcpf-${stamp}@example.test`;
    const res = await submit({
      p_address: { ...SIGNUP_ADDRESS, cpf: "111.444.777-00" },
      p_creator: { full_name: "Bad Cpf", email },
    });
    assert.ok(res.error);
    assert.match(res.error!.message, /INVALID_ADDRESS/);
    const c = await admin
      .from("creators")
      .select("id")
      .eq("organization_id", orgA)
      .eq("email", email);
    assert.equal((c.data ?? []).length, 0);
  });

  test("signup: the address becomes the creator's current one, normalized, no PII in events", async () => {
    const res = await submit();
    assert.ifError(res.error);
    const creatorId = res.data.creator_id as string;
    const appId = res.data.application_id as string;

    const addr = await admin
      .from("creator_addresses")
      .select("*")
      .eq("organization_id", orgA)
      .eq("creator_id", creatorId);
    assert.equal(addr.data!.length, 1);
    const a = addr.data![0];
    assert.equal(a.is_current, true);
    assert.equal(a.source, "signup");
    assert.equal(a.source_request_id, null);
    assert.equal(a.recipient_name, "Signup Creator");
    assert.equal(a.cpf, "11144477735");
    assert.equal(a.postal_code, "30140110");
    assert.equal(a.state, "MG");

    const app = await admin
      .from("applications")
      .select("status")
      .eq("id", appId)
      .single();
    assert.equal(app.data!.status, "new");

    const events = await admin
      .from("creator_events")
      .select("type, data")
      .eq("application_id", appId);
    assert.ok(events.data!.some((e) => e.type === "address_submitted"));
    const evText = JSON.stringify(events.data);
    for (const leak of ["11144477735", "Aimorés", "30140110"]) {
      assert.ok(!evText.includes(leak), `event leaked "${leak}"`);
    }

    // A later signup by the same person replaces the current address.
    const again = await submit({
      p_address: { ...SIGNUP_ADDRESS, street: "Rua Nova" },
    });
    assert.ifError(again.error);
    assert.equal(again.data.creator_id, creatorId);
    const current = await admin
      .from("creator_addresses")
      .select("street")
      .eq("creator_id", creatorId)
      .eq("is_current", true)
      .single();
    assert.equal(current.data!.street, "Rua Nova");
  });

  test("signup: a member adding a creator by hand may omit the address", async () => {
    const res = await submit(
      {
        p_address: null,
        p_source: "manual",
        p_creator: { full_name: "Manual", email: `manual-${stamp}@example.test` },
      },
      ownerA,
    );
    assert.ifError(res.error);
    const addr = await admin
      .from("creator_addresses")
      .select("id")
      .eq("creator_id", res.data.creator_id);
    assert.equal((addr.data ?? []).length, 0);
  });
});
