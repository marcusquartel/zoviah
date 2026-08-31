import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resolveHostContext,
  deriveRootDomain,
  normalizeHost,
  isReservedSubdomain,
  isValidSubdomainFormat,
  suggestSubdomain,
  RESERVED_SUBDOMAINS,
} from "../src/lib/tenant/host.ts";

const ROOT = "zoviah.app";
const r = (h: string | null | undefined) => resolveHostContext(h, ROOT);

test("root hosts: platform base, www, vercel, localhost, IPs, empty", () => {
  for (const h of [
    "zoviah.app",
    "www.zoviah.app",
    "ZOVIAH.APP",
    "zoviah.app:443",
    "zoviah.app.", // trailing dot
    "zoviah-abc123.vercel.app",
    "zoviah.vercel.app",
    "localhost",
    "localhost:3001",
    "127.0.0.1",
    "127.0.0.1:3001",
    "::1",
    "10.0.0.5",
    "",
    null,
  ]) {
    assert.deepEqual(r(h), { kind: "root" }, String(h));
  }
});

test("tenant hosts: <subdomain>.zoviah.app -> { tenant, subdomain }", () => {
  assert.deepEqual(r("rareway.zoviah.app"), {
    kind: "tenant",
    subdomain: "rareway",
  });
  assert.deepEqual(r("rare-way.zoviah.app"), {
    kind: "tenant",
    subdomain: "rare-way",
  });
  assert.deepEqual(r("Rare-Way.Zoviah.App:443"), {
    kind: "tenant",
    subdomain: "rare-way",
  });
  assert.deepEqual(r("acme2.zoviah.app"), { kind: "tenant", subdomain: "acme2" });
});

test("reserved subdomains never resolve to a tenant", () => {
  for (const label of ["www", "app", "admin", "api", "auth", "mail", "support"]) {
    assert.ok(RESERVED_SUBDOMAINS.has(label));
    const out = r(`${label}.zoviah.app`);
    assert.notEqual(out.kind, "tenant", label);
  }
});

test("malformed / multi-level / bad-slug hosts -> unknown (never a tenant)", () => {
  for (const h of [
    "a.b.zoviah.app", // two labels
    "-bad.zoviah.app", // leading hyphen
    "bad-.zoviah.app", // trailing hyphen
    "b__ad.zoviah.app", // underscore
    "UPPER_only.zoviah.app",
    "x".repeat(64) + ".zoviah.app", // > 63
    "evil.com", // not under root
    "zoviah.app.evil.com",
    "notzoviah.app",
  ]) {
    assert.notEqual(r(h).kind, "tenant", h);
  }
});

test("local tenant testing: <subdomain>.localhost / <subdomain>.lvh.me", () => {
  assert.deepEqual(r("rareway.localhost:3001"), {
    kind: "tenant",
    subdomain: "rareway",
  });
  assert.deepEqual(r("acme.lvh.me"), { kind: "tenant", subdomain: "acme" });
});

test("normalizeHost: lowercases, strips port / trailing dot / ipv6 brackets", () => {
  assert.equal(normalizeHost(" ZOVIAH.app:8080 "), "zoviah.app");
  assert.equal(normalizeHost("host."), "host");
  assert.equal(normalizeHost("[::1]:3000"), "::1");
  assert.equal(normalizeHost(null), "");
});

test("deriveRootDomain: env precedence", () => {
  assert.equal(
    deriveRootDomain({ NEXT_PUBLIC_ROOT_DOMAIN: "zoviah.app" }),
    "zoviah.app",
  );
  assert.equal(
    deriveRootDomain({ NEXT_PUBLIC_ROOT_DOMAIN: "https://zoviah.app/" }),
    "zoviah.app",
  );
  assert.equal(
    deriveRootDomain({ NEXT_PUBLIC_APP_URL: "https://zoviah.app" }),
    "zoviah.app",
  );
  assert.equal(
    deriveRootDomain({ NEXT_PUBLIC_APP_URL: "https://app.zoviah.app" }),
    "app.zoviah.app",
  );
  assert.equal(deriveRootDomain({}), "zoviah.app");
});

test("host resolution never selects an org from a query param — only the host", () => {
  // resolveHostContext takes only the host; there is no code path that reads a
  // ?org= / ?tenant= param. A different root domain still yields the same label.
  assert.deepEqual(resolveHostContext("rareway.acme.dev", "acme.dev"), {
    kind: "tenant",
    subdomain: "rareway",
  });
  assert.deepEqual(resolveHostContext("rareway.acme.dev?org=evil", "acme.dev"), {
    // the '?org=evil' is part of the (malformed) host string -> not a clean label
    kind: "unknown",
  });
});

test("subdomain identity is independent of slug — the host is matched on subdomain", () => {
  // "rare-way" (the slug shape) and "rareway" (the commercial subdomain) are
  // different labels. The resolver just extracts the label; queries.ts then
  // matches it against organizations.subdomain, never organizations.slug.
  assert.deepEqual(r("rareway.zoviah.app"), {
    kind: "tenant",
    subdomain: "rareway",
  });
  assert.deepEqual(r("rare-way.zoviah.app"), {
    kind: "tenant",
    subdomain: "rare-way",
  });
  assert.notDeepEqual(r("rareway.zoviah.app"), r("rare-way.zoviah.app"));
});

test("isValidSubdomainFormat / isReservedSubdomain", () => {
  for (const ok of ["rareway", "rare-way", "acme2", "a", "x".repeat(63)]) {
    assert.equal(isValidSubdomainFormat(ok), true, ok);
  }
  for (const bad of ["", "-x", "x-", "x_y", "Rareway", "a.b", "x".repeat(64)]) {
    assert.equal(isValidSubdomainFormat(bad), false, bad);
  }
  for (const label of ["www", "admin", "api", "APP", " support "]) {
    assert.equal(isReservedSubdomain(label), true, label);
  }
  assert.equal(isReservedSubdomain("rareway"), false);
});

test("suggestSubdomain: name -> one lowercase word, no separators, clamped", () => {
  assert.equal(suggestSubdomain("Rare Way"), "rareway");
  assert.equal(suggestSubdomain("  Açaí & Co.  "), "acaico");
  assert.equal(suggestSubdomain("ACME-123"), "acme123");
  assert.equal(suggestSubdomain("x".repeat(80)).length, 63);
});
