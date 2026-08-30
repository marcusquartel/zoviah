/**
 * FASE 6B — product feedback. Real Supabase, no Claude.
 *
 * Feature requests + §37 organization-scoped voting + published-only roadmap /
 * changelog visibility + platform-admin curation.
 *
 * Skips until migration 20260830000003 is applied.
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
  const t = await probe.from("feature_requests").select("id").limit(1);
  const f = await probe.rpc("get_roadmap");
  ready = !t.error && !f.error;
}

const skip = !configured
  ? "Supabase credentials not set"
  : !ready
    ? "Phase 6B product schema not applied (run supabase/migrations/20260830000003_product_feedback.sql)"
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

describe("Phase 6B — product feedback", { skip }, () => {
  let admin: SupabaseClient;
  let pa: SupabaseClient;
  let ownerA1: SupabaseClient;
  let ownerA2: SupabaseClient; // second seat, same org A
  let ownerB: SupabaseClient; // org B
  const users: Record<string, { id: string; email: string; password: string }> =
    {};
  let orgA = "";
  let orgB = "";
  let requestId = "";
  let roadmapId = "";
  let changelogId = "";

  async function mkUser(key: string) {
    const email = `p6b-p-${key}-${stamp}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: pwd(key),
      email_confirm: true,
    });
    assert.ifError(error);
    users[key] = { id: data.user!.id, email, password: pwd(key) };
  }

  before(async () => {
    admin = createClient(url!, serviceKey!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    for (const k of ["pa", "a1", "a2", "b"]) await mkUser(k);
    assert.ifError(
      (await admin.from("platform_admins").insert({ user_id: users.pa.id })).error,
    );

    const oA = await admin
      .from("organizations")
      .insert({ name: "P6B P A", slug: `p6b-p-a-${stamp}` })
      .select("id")
      .single();
    orgA = oA.data!.id;
    const oB = await admin
      .from("organizations")
      .insert({ name: "P6B P B", slug: `p6b-p-b-${stamp}` })
      .select("id")
      .single();
    orgB = oB.data!.id;
    await admin.from("organization_members").insert([
      { organization_id: orgA, user_id: users.a1.id, role: "owner" },
      { organization_id: orgA, user_id: users.a2.id, role: "admin" },
      { organization_id: orgB, user_id: users.b.id, role: "owner" },
    ]);

    pa = await signedIn(users.pa.email, users.pa.password);
    ownerA1 = await signedIn(users.a1.email, users.a1.password);
    ownerA2 = await signedIn(users.a2.email, users.a2.password);
    ownerB = await signedIn(users.b.email, users.b.password);
  });

  after(async () => {
    if (!admin) return;
    for (const id of [roadmapId].filter(Boolean)) {
      await admin.from("roadmap_items").delete().eq("id", id);
    }
    for (const id of [changelogId].filter(Boolean)) {
      await admin.from("changelog_entries").delete().eq("id", id);
    }
    for (const id of [orgA, orgB].filter(Boolean)) {
      await admin.from("organizations").delete().eq("id", id);
    }
    await admin.from("platform_admins").delete().eq("user_id", users.pa.id);
    for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
  });

  test("1) submit a feature request -> submitting org auto-backs it (1 vote)", async () => {
    const r = await ownerA1.rpc("submit_feature_request", {
      p_organization_id: orgA,
      p_title: "Exportar creators em CSV",
      p_problem: "Preciso levar a base para uma planilha externa toda semana.",
      p_use_case: "Relatório semanal para a diretoria.",
      p_frequency: "often",
      p_importance: "important",
    });
    assert.ifError(r.error);
    requestId = r.data.id;

    const list = await ownerA1.rpc("list_feature_requests", {
      p_organization_id: orgA,
    });
    assert.ifError(list.error);
    const row = (list.data as { id: string; vote_count: number; voted: boolean; is_own: boolean }[]).find(
      (x) => x.id === requestId,
    );
    assert.ok(row);
    assert.equal(row!.vote_count, 1);
    assert.equal(row!.voted, true);
    assert.equal(row!.is_own, true);
  });

  test("2) §37 — a second seat in the same org does NOT add a vote", async () => {
    const v = await ownerA2.rpc("vote_feature_request", {
      p_organization_id: orgA,
      p_request_id: requestId,
      p_vote: true,
    });
    assert.ifError(v.error);
    assert.equal(v.data.vote_count, 1); // still one — the org already voted

    const rows = await admin
      .from("feature_request_votes")
      .select("id")
      .eq("request_id", requestId)
      .eq("organization_id", orgA);
    assert.equal(rows.data!.length, 1);
  });

  test("3) a different organization adds exactly one vote; can remove it", async () => {
    // Request is still 'submitted' -> not visible to org B yet.
    let list = await ownerB.rpc("list_feature_requests", { p_organization_id: orgB });
    assert.ok(!(list.data as { id: string }[]).some((x) => x.id === requestId));

    // Admin triages it onto the shared board.
    assert.ifError(
      (await pa.rpc("admin_update_feature_request", {
        p_request_id: requestId,
        p_status: "under_review",
      })).error,
    );

    list = await ownerB.rpc("list_feature_requests", { p_organization_id: orgB });
    assert.ok((list.data as { id: string }[]).some((x) => x.id === requestId));

    const v = await ownerB.rpc("vote_feature_request", {
      p_organization_id: orgB,
      p_request_id: requestId,
      p_vote: true,
    });
    assert.ifError(v.error);
    assert.equal(v.data.vote_count, 2);

    const un = await ownerB.rpc("vote_feature_request", {
      p_organization_id: orgB,
      p_request_id: requestId,
      p_vote: false,
    });
    assert.ifError(un.error);
    assert.equal(un.data.vote_count, 1);
  });

  test("4) roadmap: only published items are visible to a tenant (§49, §39 no dates)", async () => {
    const up = await pa.rpc("admin_upsert_roadmap_item", {
      p_id: null,
      p_title: "Exportação de dados",
      p_summary: "Exportar creators e candidaturas.",
      p_status: "planned",
      p_sort_order: 1,
      p_feature_request_id: requestId,
      p_published: false,
    });
    assert.ifError(up.error);
    roadmapId = up.data.id;

    // Draft -> not visible.
    let rm = await ownerA1.rpc("get_roadmap");
    assert.ok(!(rm.data as { id: string }[]).some((x) => x.id === roadmapId));

    // Publish -> visible, and carries no date field.
    assert.ifError(
      (await pa.rpc("admin_upsert_roadmap_item", {
        p_id: roadmapId,
        p_title: "Exportação de dados",
        p_summary: "Exportar creators e candidaturas.",
        p_status: "planned",
        p_sort_order: 1,
        p_feature_request_id: requestId,
        p_published: true,
      })).error,
    );
    rm = await ownerA1.rpc("get_roadmap");
    const item = (rm.data as Record<string, unknown>[]).find((x) => x.id === roadmapId);
    assert.ok(item);
    assert.ok(!("date" in item!) && !("eta" in item!) && !("deadline" in item!));
  });

  test("5) changelog: draft hidden, published visible", async () => {
    const dr = await pa.rpc("admin_upsert_changelog_entry", {
      p_id: null,
      p_title: "Exportação de dados disponível",
      p_summary: "Agora dá para exportar em CSV.",
      p_content: "A exportação está disponível no menu de cada listagem.",
      p_status: "draft",
      p_related_roadmap_item_id: roadmapId,
    });
    assert.ifError(dr.error);
    changelogId = dr.data.id;

    let cl = await ownerA1.rpc("get_changelog");
    assert.ok(!(cl.data as { id: string }[]).some((x) => x.id === changelogId));

    assert.ifError(
      (await pa.rpc("admin_upsert_changelog_entry", {
        p_id: changelogId,
        p_title: "Exportação de dados disponível",
        p_summary: "Agora dá para exportar em CSV.",
        p_content: "A exportação está disponível no menu de cada listagem.",
        p_status: "published",
        p_related_roadmap_item_id: roadmapId,
      })).error,
    );
    cl = await ownerA1.rpc("get_changelog");
    const entry = (cl.data as { id: string; published_at: string | null }[]).find(
      (x) => x.id === changelogId,
    );
    assert.ok(entry);
    assert.ok(entry!.published_at);
  });

  test("6) tenant cannot call the admin curation RPCs", async () => {
    for (const call of [
      ownerA1.rpc("admin_list_feature_requests"),
      ownerA1.rpc("admin_upsert_roadmap_item", {
        p_id: null,
        p_title: "x",
        p_summary: null,
        p_status: "planned",
        p_sort_order: 0,
        p_feature_request_id: null,
        p_published: true,
      }),
      ownerA1.rpc("admin_list_changelog_entries"),
    ]) {
      const res = await call;
      assert.ok(res.error, "expected FORBIDDEN");
    }
  });

  test("7) a tenant cannot read another tenant's raw vote rows", async () => {
    const rows = await ownerB
      .from("feature_request_votes")
      .select("id")
      .eq("organization_id", orgA);
    assert.equal(rows.data!.length, 0);
  });
});
