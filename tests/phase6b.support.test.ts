/**
 * FASE 6B — support system. Real Supabase, ZERO Claude (§68): the assistant
 * pipeline is unit-tested with a mock elsewhere; here we exercise the SQL
 * surface the server action drives (conversations, messages, feedback,
 * escalation, admin RPCs) and its RLS.
 *
 * Skips until migration 20260830000002 is applied.
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
  const t = await probe.from("support_conversations").select("id").limit(1);
  const f = await probe.rpc("search_help_articles", { p_query: "x" });
  ready = !t.error && !f.error;
}

const skip = !configured
  ? "Supabase credentials not set"
  : !ready
    ? "Phase 6B support schema not applied (run supabase/migrations/20260830000002_support_system.sql)"
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

describe("Phase 6B — support", { skip }, () => {
  let admin: SupabaseClient;
  let pa: SupabaseClient;
  let owner: SupabaseClient; // org A
  let outsider: SupabaseClient; // org B
  const users: Record<string, { id: string; email: string; password: string }> =
    {};
  let orgA = "";
  let orgB = "";
  let articleId = "";
  let draftId = "";
  let conversationId = "";
  let ticketId = "";

  async function mkUser(key: string) {
    const email = `p6b-s-${key}-${stamp}@example.test`;
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
    for (const k of ["pa", "owner", "outsider"]) await mkUser(k);
    assert.ifError(
      (await admin.from("platform_admins").insert({ user_id: users.pa.id })).error,
    );

    for (const [key, slug] of [
      ["A", `p6b-s-a-${stamp}`],
      ["B", `p6b-s-b-${stamp}`],
    ] as const) {
      const o = await admin
        .from("organizations")
        .insert({ name: `P6B S ${key}`, slug })
        .select("id")
        .single();
      assert.ifError(o.error);
      if (key === "A") orgA = o.data!.id;
      else orgB = o.data!.id;
    }
    await admin.from("organization_members").insert([
      { organization_id: orgA, user_id: users.owner.id, role: "owner" },
      { organization_id: orgB, user_id: users.outsider.id, role: "owner" },
    ]);

    // One published article + one draft.
    const pub = await admin
      .from("help_articles")
      .insert({
        category: "Endereço",
        title: "Como solicitar o endereço de um creator",
        slug: `solicitar-endereco-${stamp}`,
        summary: "Use o botão Solicitar endereço na ficha do creator.",
        content:
          "Na ficha do creator, clique em Solicitar endereço. O creator recebe um link seguro para preencher. O endereço fica disponível quando ele conclui.",
        keywords: ["endereço", "solicitar", "creator"],
        status: "published",
      })
      .select("id")
      .single();
    assert.ifError(pub.error);
    articleId = pub.data!.id;

    const dr = await admin
      .from("help_articles")
      .insert({
        category: "Conta",
        title: "Rascunho interno",
        slug: `rascunho-${stamp}`,
        content: "Conteúdo ainda não revisado.",
        status: "draft",
      })
      .select("id")
      .single();
    assert.ifError(dr.error);
    draftId = dr.data!.id;

    pa = await signedIn(users.pa.email, users.pa.password);
    owner = await signedIn(users.owner.email, users.owner.password);
    outsider = await signedIn(users.outsider.email, users.outsider.password);
  });

  after(async () => {
    if (!admin) return;
    for (const id of [orgA, orgB].filter(Boolean)) {
      await admin.from("organizations").delete().eq("id", id);
    }
    for (const id of [articleId, draftId].filter(Boolean)) {
      await admin.from("help_articles").delete().eq("id", id);
    }
    await admin.from("platform_admins").delete().eq("user_id", users.pa.id);
    for (const u of Object.values(users)) await admin.auth.admin.deleteUser(u.id);
  });

  test("1) knowledge search returns published, hides drafts", async () => {
    const r = await owner.rpc("search_help_articles", {
      p_query: "solicitar endereço creator",
    });
    assert.ifError(r.error);
    const rows = r.data as { id: string; title: string }[];
    assert.ok(rows.some((a) => a.id === articleId));
    assert.ok(!rows.some((a) => a.id === draftId));

    // A tenant cannot read a draft row directly either (RLS).
    const direct = await owner
      .from("help_articles")
      .select("id")
      .eq("id", draftId)
      .maybeSingle();
    assert.equal(direct.data, null);
  });

  test("2) conversation lifecycle: start -> append -> feedback resolves + ai_resolved", async () => {
    const s = await owner.rpc("support_start_conversation", {
      p_organization_id: orgA,
      p_route: "/app/creators",
      p_module: "creators",
    });
    assert.ifError(s.error);
    conversationId = s.data.conversation_id;

    const a = await owner.rpc("support_append_message", {
      p_conversation_id: conversationId,
      p_user_content: "Como peço o endereço?",
      p_assistant_content: "Use o botão Solicitar endereço na ficha do creator.",
      p_article_refs: [articleId],
      p_model: "mock-support-model",
      p_input_tokens: 120,
      p_output_tokens: 40,
      p_latency_ms: 8,
    });
    assert.ifError(a.error);

    const msgs = await owner
      .from("support_messages")
      .select("role, content, article_refs, input_tokens, output_tokens, model")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    assert.equal(msgs.data!.length, 2);
    assert.equal(msgs.data![0].role, "user");
    assert.equal(msgs.data![1].role, "assistant");
    assert.deepEqual(msgs.data![1].article_refs, [articleId]);
    assert.equal(msgs.data![1].input_tokens, 120); // §14 usage recorded
    assert.equal(msgs.data![1].output_tokens, 40);

    const fb = await owner.rpc("support_feedback", {
      p_conversation_id: conversationId,
      p_resolved: true,
    });
    assert.ifError(fb.error);
    const conv = await owner
      .from("support_conversations")
      .select("status, ai_resolved, closed_at")
      .eq("id", conversationId)
      .single();
    assert.equal(conv.data!.status, "resolved");
    assert.equal(conv.data!.ai_resolved, true);
    assert.ok(conv.data!.closed_at);
  });

  test("3) another tenant cannot see the conversation or its messages", async () => {
    const conv = await outsider
      .from("support_conversations")
      .select("id")
      .eq("id", conversationId)
      .maybeSingle();
    assert.equal(conv.data, null);
    const msgs = await outsider
      .from("support_messages")
      .select("id")
      .eq("conversation_id", conversationId);
    assert.equal(msgs.data!.length, 0);
    // And cannot append to it.
    const a = await outsider.rpc("support_append_message", {
      p_conversation_id: conversationId,
      p_user_content: "x",
      p_assistant_content: "y",
      p_article_refs: [],
      p_model: null,
      p_input_tokens: null,
      p_output_tokens: null,
      p_latency_ms: null,
    });
    assert.ok(a.error);
    assert.match(a.error!.message, /FORBIDDEN/);
  });

  test("4) escalation creates a ticket, marks the conversation escalated", async () => {
    const s = await owner.rpc("support_start_conversation", {
      p_organization_id: orgA,
      p_route: "/app/shipments",
      p_module: "shipments",
    });
    assert.ifError(s.error);
    const cid = s.data.conversation_id;

    const e = await owner.rpc("support_escalate", {
      p_conversation_id: cid,
      p_type: "bug",
      p_subject: "Rastreio não atualiza",
      p_description: "O status do envio ficou parado em 'enviado' há 5 dias.",
    });
    assert.ifError(e.error);
    ticketId = e.data.ticket_id;

    const conv = await owner
      .from("support_conversations")
      .select("status")
      .eq("id", cid)
      .single();
    assert.equal(conv.data!.status, "escalated");

    const tk = await owner
      .from("support_tickets")
      .select("status, type, subject, organization_id, module")
      .eq("id", ticketId)
      .single();
    assert.equal(tk.data!.status, "open");
    assert.equal(tk.data!.type, "bug");
    assert.equal(tk.data!.organization_id, orgA);
    assert.equal(tk.data!.module, "shipments");
  });

  test("5) tickets are tenant-scoped; another tenant sees nothing", async () => {
    const mine = await owner.from("support_tickets").select("id");
    assert.ok(mine.data!.some((t) => t.id === ticketId));
    const theirs = await outsider
      .from("support_tickets")
      .select("id")
      .eq("id", ticketId)
      .maybeSingle();
    assert.equal(theirs.data, null);
  });

  test("6) admin RPCs: platform admin only", async () => {
    const denied = await owner.rpc("admin_support_overview");
    assert.ok(denied.error);
    assert.match(denied.error!.message, /FORBIDDEN/);

    const ov = await pa.rpc("admin_support_overview");
    assert.ifError(ov.error);
    assert.ok(ov.data.conversations >= 2);
    assert.ok(ov.data.ai_resolved >= 1);
    assert.ok(ov.data.escalated >= 1);
    // rate = ai_resolved / (ai_resolved + escalated), in [0,1]
    assert.ok(ov.data.ai_resolution_rate === null || ov.data.ai_resolution_rate <= 1);

    const list = await pa.rpc("admin_list_support_tickets", { p_status: "open" });
    assert.ifError(list.error);
    assert.ok((list.data as { id: string }[]).some((t) => t.id === ticketId));

    const detail = await pa.rpc("admin_get_support_ticket", { p_ticket_id: ticketId });
    assert.ifError(detail.error);
    assert.equal(detail.data.organization_name, "P6B S A");
  });

  test("7) admin updates a ticket: assign, status, notes", async () => {
    const u = await pa.rpc("admin_update_support_ticket", {
      p_ticket_id: ticketId,
      p_status: "in_progress",
      p_priority: "high",
      p_assign_self: true,
      p_admin_notes: "Investigando com a transportadora.",
    });
    assert.ifError(u.error);
    const tk = await admin
      .from("support_tickets")
      .select("status, priority, assigned_to, admin_notes")
      .eq("id", ticketId)
      .single();
    assert.equal(tk.data!.status, "in_progress");
    assert.equal(tk.data!.priority, "high");
    assert.equal(tk.data!.assigned_to, users.pa.id);

    const done = await pa.rpc("admin_update_support_ticket", {
      p_ticket_id: ticketId,
      p_status: "resolved",
    });
    assert.ifError(done.error);
    const tk2 = await admin
      .from("support_tickets")
      .select("resolved_at")
      .eq("id", ticketId)
      .single();
    assert.ok(tk2.data!.resolved_at);
  });

  test("8) knowledge admin: platform admin upserts an article, tenant cannot", async () => {
    const denied = await owner.rpc("admin_upsert_help_article", {
      p_id: null,
      p_category: "Conta",
      p_title: "Hack",
      p_slug: `hack-${stamp}`,
      p_summary: null,
      p_content: "x".repeat(20),
      p_keywords: [],
      p_status: "published",
    });
    assert.ok(denied.error);

    const ok = await pa.rpc("admin_upsert_help_article", {
      p_id: articleId,
      p_category: "Endereço",
      p_title: "Como solicitar o endereço de um creator (rev)",
      p_slug: `solicitar-endereco-${stamp}`,
      p_summary: "Atualizado.",
      p_content: "Conteúdo revisado com o passo a passo completo.",
      p_keywords: ["endereço", "creator"],
      p_status: "published",
    });
    assert.ifError(ok.error);
    assert.equal(ok.data.id, articleId);
  });
});
