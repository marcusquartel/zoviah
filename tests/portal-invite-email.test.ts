import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPortalInviteEmail } from "../src/lib/notifications/portal-invite-email.ts";

test("invite e-mail carries the link and the brand", () => {
  const url = "https://zoviah.app/portal/convite/abc";
  const mail = buildPortalInviteEmail({ creatorName: "Dayane", organizationName: "Rare Way", url });
  assert.equal(mail.subject, "Seu portal de creator Rare Way está pronto");
  assert.match(mail.text, /https:\/\/zoviah\.app\/portal\/convite\/abc/);
  assert.match(mail.html, /href="https:\/\/zoviah\.app\/portal\/convite\/abc"/);
});

test("invite e-mail escapes names", () => {
  const mail = buildPortalInviteEmail({ creatorName: "<b>x</b>", organizationName: "A & B", url: "https://x" });
  assert.doesNotMatch(mail.html, /<b>x<\/b>/);
  assert.match(mail.html, /A &amp; B/);
});
