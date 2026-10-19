/**
 * FASE 8C — SEC-003: submit_application self-defence (payload + rate limits).
 *
 * Real Supabase, no Claude, no e-mail. Every test calls the RPC **directly**
 * with the anon key — the attack path the audit flagged — and asserts the
 * defences now live in the function, not just the Next.js wrapper.
 *
 * Skips (does not fail) until migration 20260903000001 is applied.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  const t = await probe.from("submission_rate_buckets").select("bucket_key").limit(1);
  ready = !t.error;
}

const skip = !configured
  ? "Supabase credentials not set"
  : !ready
    ? "migration 20260903000001_harden_submit_application.sql not applied"
    : false;

const stamp = Date.now();
// Anonymous submissions must carry a shipping address (20260906000001).
const SIGNUP_ADDRESS = {
  cpf: "11144477735",
  postal_code: "30140110",
  street: "Rua Teste",
  number: "100",
  complement: null,
  neighborhood: "Centro",
  city: "Belo Horizonte",
  state: "MG",
};
function anon(): SupabaseClient {
  return createClient(url!, anonKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
const pidKey = (programId: string, identity: string) =>
  "sub:pid:" +
  createHash("sha256")
    .update(`${programId}|${identity.toLowerCase()}`, "utf8")
    .digest("hex");

describe("Phase 8C — SEC-003 submit_application hardening", { skip }, () => {
  let admin: SupabaseClient;
  const orgs: string[] = [];
  const bucketKeys = new Set<string>();
  const users: string[] = [];

  // org A: active program `progA` + draft program `draftA`
  const slugA = `sec3-a-${stamp}`;
  const slugB = `sec3-b-${stamp}`;
  let orgA = "";
  let orgB = "";
  let progAId = "";
  const progASlug = "creators";
  const draftASlug = "draft";
  let progBId = "";

  async function mkOrg(slug: string, name: string): Promise<string> {
    const r = await admin
      .from("organizations")
      .insert({ name, slug })
      .select("id")
      .single();
    assert.ifError(r.error);
    orgs.push(r.data!.id);
    return r.data!.id;
  }
  async function mkProgram(
    orgId: string,
    slug: string,
    status: string,
  ): Promise<string> {
    const r = await admin
      .from("programs")
      .insert({
        organization_id: orgId,
        name: slug,
        slug,
        status,
        form_version: 1,
      })
      .select("id")
      .single();
    assert.ifError(r.error);
    return r.data!.id;
  }

  before(async () => {
    admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    orgA = await mkOrg(slugA, "SEC3 A");
    orgB = await mkOrg(slugB, "SEC3 B");
    progAId = await mkProgram(orgA, progASlug, "active");
    await mkProgram(orgA, draftASlug, "draft");
    progBId = await mkProgram(orgB, progASlug, "active"); // same slug, other org
    bucketKeys.add(`sub:prog:${progAId}`);
    bucketKeys.add(`sub:prog:${progBId}`);
  });

  after(async () => {
    if (!admin) return;
    for (const id of orgs) {
      await admin.from("organizations").delete().eq("id", id);
    }
    for (const k of bucketKeys) {
      await admin.from("submission_rate_buckets").delete().eq("bucket_key", k);
    }
    for (const u of users) await admin.auth.admin.deleteUser(u);
  });

  // ---- helper: one direct anon RPC call --------------------------------
  function submit(
    over: Record<string, unknown> = {},
    orgSlug = slugA,
    programSlug = progASlug,
  ) {
    return anon().rpc("submit_application", {
      p_org_slug: orgSlug,
      p_program_slug: programSlug,
      p_form_version: 1,
      p_answers: { topics: "beleza" },
      p_field_snapshot: [{ field_key: "full_name", label: "Nome", field_type: "text" }],
      p_creator: { full_name: "Ana Souza", email: `ana-${stamp}-${Math.random()}@example.test` },
      p_socials: [],
      p_utm: {},
      p_referrer: null,
      p_source: null,
      p_address: SIGNUP_ADDRESS,
      ...over,
    });
  }

  // 1) valid normal call still works
  test("valid direct anon submission still succeeds", async () => {
    const email = `ok-${stamp}@example.test`;
    bucketKeys.add(pidKey(progAId, email));
    const r = await submit({ p_creator: { full_name: "Ok Person", email } });
    assert.ifError(r.error);
    assert.equal(r.data.ok, true);
    assert.ok(r.data.creator_id && r.data.application_id);

    const app = await admin
      .from("applications")
      .select("organization_id, status")
      .eq("id", r.data.application_id)
      .single();
    assert.equal(app.data!.organization_id, orgA);
    assert.equal(app.data!.status, "new");
  });

  // 2) non-existent program
  test("non-existent program -> PROGRAM_NOT_FOUND", async () => {
    const r = await submit({}, slugA, `nope-${stamp}`);
    assert.ok(r.error);
    assert.match(r.error!.message, /PROGRAM_NOT_FOUND/);
  });

  // 3) program of another organization (slug A + a program that lives in org B)
  test("cross-org program slug -> PROGRAM_NOT_FOUND", async () => {
    // progBSlug === progASlug === "creators" but belongs to org B; called with slug A
    const r = await submit({}, slugA, progASlug); // resolves to org A's program (fine)
    assert.ifError(r.error); // sanity: A's own program works
    // now the real cross check: org B's slug + A's program slug does NOT reach A
    const r2 = await submit({}, slugB, draftASlug); // draftA is in org A, not B
    assert.ok(r2.error);
    assert.match(r2.error!.message, /PROGRAM_NOT_FOUND/);
  });

  // 4) draft program
  test("draft program -> PROGRAM_NOT_ACCEPTING", async () => {
    const r = await submit({}, slugA, draftASlug);
    assert.ok(r.error);
    assert.match(r.error!.message, /PROGRAM_NOT_ACCEPTING/);
  });

  // 5) oversized answers total
  test("p_answers over 20 KB -> PAYLOAD_TOO_LARGE", async () => {
    const r = await submit({ p_answers: { bio: "x".repeat(21000) } });
    assert.ok(r.error);
    assert.match(r.error!.message, /PAYLOAD_TOO_LARGE/);
  });

  // 6) one answer value too long (total still under 20 KB)
  test("one answer value over 5000 chars -> ANSWER_TOO_LONG", async () => {
    const r = await submit({ p_answers: { bio: "y".repeat(6000) } });
    assert.ok(r.error);
    assert.match(r.error!.message, /ANSWER_TOO_LONG/);
  });

  // 7) too many fields
  test("more than 60 answer keys -> TOO_MANY_FIELDS", async () => {
    const answers: Record<string, string> = {};
    for (let i = 0; i < 61; i += 1) answers[`f${i}`] = "v";
    const r = await submit({ p_answers: answers });
    assert.ok(r.error);
    assert.match(r.error!.message, /TOO_MANY_FIELDS/);
  });

  // 8) malformed socials
  test("socials: too many / bad platform / huge number -> INVALID_PAYLOAD", async () => {
    const six = Array.from({ length: 6 }, (_, i) => ({
      platform: "instagram",
      handle_normalized: `h${i}`,
    }));
    assert.match((await submit({ p_socials: six })).error!.message, /INVALID_PAYLOAD/);
    assert.match(
      (await submit({ p_socials: [{ platform: "youtube", handle_normalized: "x" }] }))
        .error!.message,
      /INVALID_PAYLOAD/,
    );
    assert.match(
      (
        await submit({
          p_socials: [
            {
              platform: "instagram",
              handle_normalized: "x",
              followers_declared: "9".repeat(30),
            },
          ],
        })
      ).error!.message,
      /INVALID_PAYLOAD/,
    );
  });

  // 9) wrong JSON container types
  test("p_creator / p_answers not an object -> INVALID_PAYLOAD", async () => {
    assert.match(
      (await submit({ p_creator: [1, 2, 3] })).error!.message,
      /INVALID_PAYLOAD/,
    );
    assert.match(
      (await submit({ p_answers: ["a", "b"] })).error!.message,
      /INVALID_PAYLOAD/,
    );
    assert.match(
      (await submit({ p_socials: { not: "an array" } })).error!.message,
      /INVALID_PAYLOAD/,
    );
  });

  // 9b) birth_date must be a real calendar date, not just "YYYY-MM-DD"
  // shaped — the regex alone would let these through. Both fail inside
  // section (d), before either rate-limit bump, so neither writes a
  // submission_rate_buckets row (nothing to add to bucketKeys for cleanup).
  test("birth_date '2026-99-99' -> INVALID_PAYLOAD", async () => {
    const r = await submit({
      p_creator: {
        full_name: "Data Invalida",
        email: `birthdate-a-${stamp}@example.test`,
        birth_date: "2026-99-99",
      },
    });
    assert.ok(r.error);
    assert.match(r.error!.message, /INVALID_PAYLOAD/);
  });

  test("birth_date '2026-02-30' -> INVALID_PAYLOAD", async () => {
    const r = await submit({
      p_creator: {
        full_name: "Data Invalida 2",
        email: `birthdate-b-${stamp}@example.test`,
        birth_date: "2026-02-30",
      },
    });
    assert.ok(r.error);
    assert.match(r.error!.message, /INVALID_PAYLOAD/);
  });

  // 10) metadata over the cap is rejected, not truncated
  test("p_referrer over 500 chars -> INVALID_PAYLOAD (rejected, not truncated)", async () => {
    const r = await submit({ p_referrer: "https://x.test/" + "a".repeat(600) });
    assert.ok(r.error);
    assert.match(r.error!.message, /INVALID_PAYLOAD/);
  });

  // 11) client cannot pick organization_id / status / creator id
  test("injected internal fields have no effect", async () => {
    const fakeId = "00000000-0000-4000-8000-000000000abc";
    const email = `inj-${stamp}@example.test`;
    bucketKeys.add(pidKey(progAId, email));
    const r = await submit({
      p_creator: {
        id: fakeId,
        organization_id: orgB, // try to bind to the other tenant
        status: "approved", // try to set an internal status
        full_name: "Injected",
        email,
      },
    });
    assert.ifError(r.error);
    assert.notEqual(r.data.creator_id, fakeId);

    const app = await admin
      .from("applications")
      .select("organization_id, status")
      .eq("id", r.data.application_id)
      .single();
    assert.equal(app.data!.organization_id, orgA); // NOT orgB
    assert.equal(app.data!.status, "new"); // NOT 'approved'

    const creator = await admin
      .from("creators")
      .select("id, organization_id")
      .eq("id", r.data.creator_id)
      .single();
    assert.equal(creator.data!.organization_id, orgA);
  });

  // 12) bump_rate_bucket is not callable by anon or authenticated
  test("bump_rate_bucket: EXECUTE revoked from anon and authenticated", async () => {
    const asAnon = await anon().rpc("bump_rate_bucket", {
      p_key: "x",
      p_max: 1,
      p_window_secs: 60,
    });
    assert.ok(asAnon.error, "anon must not execute bump_rate_bucket");
    assert.ok(!asAnon.data);

    const email = `bumpuser-${stamp}@example.test`;
    const password = `Bump1!${stamp}zz`;
    const u = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    assert.ifError(u.error);
    users.push(u.data.user!.id);
    const c = anon();
    assert.ifError((await c.auth.signInWithPassword({ email, password })).error);
    const asAuthed = await c.rpc("bump_rate_bucket", {
      p_key: "x",
      p_max: 1,
      p_window_secs: 60,
    });
    assert.ok(asAuthed.error, "authenticated must not execute bump_rate_bucket");
    assert.ok(!asAuthed.data);
  });

  // 13) identity limit — real limit (20 / hour / (program, identity))
  test("21 submissions with the same identity -> IDENTITY_RATE_LIMITED on the 21st", async () => {
    const email = `idlimit-${stamp}@example.test`;
    bucketKeys.add(pidKey(progAId, email));
    for (let i = 1; i <= 20; i += 1) {
      const r = await submit({ p_creator: { full_name: "Id Limit", email } });
      assert.ifError(r.error);
      assert.equal(r.data.ok, true, `submission ${i} should pass`);
    }
    const blocked = await submit({ p_creator: { full_name: "Id Limit", email } });
    assert.ok(blocked.error);
    assert.match(blocked.error!.message, /IDENTITY_RATE_LIMITED/);
  });

  // 14) concurrency — the real identity limit, no over-admission
  test("30 concurrent same-identity submissions: exactly 20 admitted", async () => {
    const email = `conc-${stamp}@example.test`;
    bucketKeys.add(pidKey(progAId, email));
    const results = await Promise.all(
      Array.from({ length: 30 }, () =>
        submit({ p_creator: { full_name: "Conc", email } }),
      ),
    );
    const ok = results.filter((r) => !r.error && r.data?.ok === true).length;
    const limited = results.filter(
      (r) => r.error && /IDENTITY_RATE_LIMITED/.test(r.error.message),
    ).length;
    assert.equal(ok, 20, "exactly 20 admitted (no over-admission)");
    assert.equal(limited, 10, "the other 10 rate-limited");

    const apps = await admin
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("program_id", progAId)
      .eq("creator_id", (await creatorIdFor(email)) ?? "");
    assert.equal(apps.count, 20);
  });

  async function creatorIdFor(email: string): Promise<string | null> {
    const r = await admin
      .from("creators")
      .select("id")
      .eq("organization_id", orgA)
      .eq("email", email.toLowerCase())
      .maybeSingle();
    return r.data?.id ?? null;
  }

  // 15) program flood limit — real limit of 200, distinct identities so the
  // per-identity cap never fires. Slow by design (201 sequential inserts);
  // this is an integration/security test, not a unit test.
  test(
    "201 submissions to one program (distinct identities) -> PROGRAM_RATE_LIMITED on the 201st",
    async () => {
      const floodOrg = await mkOrg(`sec3-flood-${stamp}`, "SEC3 Flood");
      const floodProg = await mkProgram(floodOrg, "creators", "active");
      bucketKeys.add(`sub:prog:${floodProg}`);

      for (let i = 1; i <= 200; i += 1) {
        const email = `flood-${stamp}-${i}@example.test`;
        bucketKeys.add(pidKey(floodProg, email));
        const r = await anon().rpc("submit_application", {
          p_org_slug: `sec3-flood-${stamp}`,
          p_program_slug: "creators",
          p_form_version: 1,
          p_answers: {},
          p_field_snapshot: [],
          p_creator: { full_name: `Flood ${i}`, email },
          p_socials: [],
          p_utm: {},
          p_referrer: null,
          p_source: null,
          p_address: SIGNUP_ADDRESS,
        });
        assert.ifError(r.error);
        assert.equal(r.data.ok, true, `flood submission ${i} should pass`);
      }
      const email201 = `flood-${stamp}-201@example.test`;
      bucketKeys.add(pidKey(floodProg, email201));
      const blocked = await anon().rpc("submit_application", {
        p_org_slug: `sec3-flood-${stamp}`,
        p_program_slug: "creators",
        p_form_version: 1,
        p_answers: {},
        p_field_snapshot: [],
        p_creator: { full_name: "Flood 201", email: email201 },
        p_socials: [],
        p_utm: {},
        p_referrer: null,
        p_source: null,
        p_address: SIGNUP_ADDRESS,
      });
      assert.ok(blocked.error);
      assert.match(blocked.error!.message, /PROGRAM_RATE_LIMITED/);
    },
  );
});
