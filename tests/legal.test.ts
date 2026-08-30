import { test } from "node:test";
import assert from "node:assert/strict";
import { getLegalLinks } from "../src/lib/legal.ts";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test("legal links: unset -> both null", () => {
  withEnv(
    {
      NEXT_PUBLIC_TERMS_URL: undefined,
      NEXT_PUBLIC_PRIVACY_POLICY_URL: undefined,
    },
    () => {
      assert.deepEqual(getLegalLinks(), { privacyUrl: null, termsUrl: null });
    },
  );
});

test("legal links: valid https URLs pass; junk / non-http rejected", () => {
  withEnv(
    {
      NEXT_PUBLIC_TERMS_URL: "https://example.com/terms",
      NEXT_PUBLIC_PRIVACY_POLICY_URL: "javascript:alert(1)",
    },
    () => {
      const r = getLegalLinks();
      assert.equal(r.termsUrl, "https://example.com/terms");
      assert.equal(r.privacyUrl, null);
    },
  );
  withEnv({ NEXT_PUBLIC_TERMS_URL: "not a url" }, () => {
    assert.equal(getLegalLinks().termsUrl, null);
  });
});
