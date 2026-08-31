import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildUserMenuItems } from "../src/components/app-shell/user-menu-items.ts";

test("menu items: a common user gets only 'Sair'", () => {
  const items = buildUserMenuItems({ isPlatformAdmin: false });
  assert.deepEqual(
    items.map((i) => i.key),
    ["logout"],
  );
  assert.equal(items[0].destructive, true);
  assert.ok(!items[0].href, "logout is an action, not a link");
  // no admin path leaks to a non-admin
  assert.ok(!items.some((i) => i.href === "/admin"));
});

test("menu items: a platform admin also gets 'Admin Zoviah' -> /admin", () => {
  const items = buildUserMenuItems({ isPlatformAdmin: true });
  assert.deepEqual(
    items.map((i) => i.key),
    ["admin", "logout"],
  );
  const admin = items.find((i) => i.key === "admin")!;
  assert.equal(admin.href, "/admin");
  assert.match(admin.label, /^Admin /);
});

test("menu items: undefined isPlatformAdmin is treated as non-admin", () => {
  assert.deepEqual(
    buildUserMenuItems({}).map((i) => i.key),
    ["logout"],
  );
});

test("regression: UserMenu never wraps a menu item in a form element", () => {
  // A form element as a child of the Base UI Menu popup breaks its item
  // traversal on open -> "This page couldn't load". Logout must be a plain
  // onClick handler.
  const src = readFileSync(
    "src/components/app-shell/user-menu.tsx",
    "utf8",
  );
  assert.doesNotMatch(src, /<form[ >]/, "no form element inside the account menu");
  assert.doesNotMatch(src, /action=\{logout\}/, "logout is not a form action");
  // it must still call the logout server action, from a transition (no nav on open)
  assert.match(src, /startTransition\(async \(\) => \{\s*await logout\(\)/);
  assert.match(src, /onClick=\{handleLogout\}/);
  // opening the menu must not run logout: handleLogout is only wired to onClick
  const openTriggers = src.match(/on(Open|OpenChange|MouseEnter|Focus)=/g) ?? [];
  assert.equal(openTriggers.length, 0, "no logout on menu-open handlers");
});

test("regression: logout server action does signOut then redirect('/login')", () => {
  const src = readFileSync("src/features/auth/actions.ts", "utf8");
  const start = src.indexOf("export async function logout(");
  assert.ok(start >= 0);
  const body = src.slice(start, src.indexOf("\n}", start) + 2);
  assert.match(body, /supabase\.auth\.signOut\(\)/);
  assert.match(body, /redirect\("\/login"\)/);
  assert.doesNotMatch(body, /\btry\s*\{/, "no try/catch around redirect()");
});
