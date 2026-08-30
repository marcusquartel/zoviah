import { test } from "node:test";
import assert from "node:assert/strict";
import { scrubEvent, scrubValue } from "../src/lib/observability/scrub.ts";

test("scrubValue: denied keys are redacted at any depth", () => {
  const input = {
    ok: "keep",
    address_snapshot: { street: "Rua X", number: "10" },
    nested: { answers: { q1: "resposta secreta" }, safe: 1 },
    list: [{ token_hash: "abc" }, { fine: true }],
  };
  const out = scrubValue(input) as Record<string, unknown>;
  assert.equal(out.ok, "keep");
  assert.equal(out.address_snapshot, "[redacted]");
  assert.equal((out.nested as Record<string, unknown>).answers, "[redacted]");
  assert.equal((out.nested as Record<string, unknown>).safe, 1);
  assert.equal((out.list as Record<string, unknown>[])[0].token_hash, "[redacted]");
  assert.equal((out.list as Record<string, unknown>[])[1].fine, true);
});

test("scrubValue: secret-shaped string values are redacted regardless of key", () => {
  const out = scrubValue({
    note: "chave sk-ant-abcdefghijklmnop123456 vazou",
    jwt: "token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N here",
    hash: "d".repeat(64),
  }) as Record<string, string>;
  assert.doesNotMatch(out.note, /sk-ant-abcdefghijklmnop/);
  assert.doesNotMatch(out.jwt, /eyJhbGciOiJI/);
  assert.match(out.hash, /redacted/);
});

test("scrubEvent: strips cookies/headers, redacts request body, anonymises user", () => {
  const event = {
    request: {
      url: "https://x/app",
      headers: { authorization: "Bearer abc" },
      cookies: { sb: "secret" },
      query_string: "token=deadbeef",
      data: { email: "a@b.com", answers: { q: "x" }, page: 2 },
    },
    user: { id: "u1", email: "a@b.com", ip_address: "1.2.3.4" },
    extra: { creator_answers: { name: "Fulana" }, count: 3 },
    breadcrumbs: [{ message: "cpf 123.456.789-09", data: { password: "p" } }],
  };
  const out = scrubEvent(event as unknown as Record<string, unknown>) as Record<
    string,
    Record<string, unknown>
  >;
  assert.equal(out.request.cookies, undefined);
  assert.equal(out.request.headers, undefined);
  assert.equal((out.request.data as Record<string, unknown>).email, "[redacted]");
  assert.equal((out.request.data as Record<string, unknown>).answers, "[redacted]");
  assert.equal((out.request.data as Record<string, unknown>).page, 2);
  assert.deepEqual(out.user, { id: "u1" });
  assert.equal((out.extra as Record<string, unknown>).creator_answers, "[redacted]");
  assert.equal((out.extra as Record<string, unknown>).count, 3);
});
