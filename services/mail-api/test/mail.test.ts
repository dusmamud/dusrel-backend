import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { signAccessToken } from "@dusrel/auth";
import { createMailApp } from "../src/app.js";
import type { MailConfig } from "../src/config.js";

const SECRET = "test-secret-do-not-use-in-production";
const config: MailConfig = {
  corsOrigin: "*",
  jwtSecret: SECRET,
  port: 3002,
};

const USER_A = { email: "arav@dusrel.example", id: "aaaaaaaa-1111-4111-8111-111111111111" };
const USER_B = { email: "priya@dusrel.example", id: "bbbbbbbb-2222-4222-8222-222222222222" };

function tokenFor(user: typeof USER_A): string {
  return signAccessToken(
    SECRET,
    { email: user.email, role: "user", sid: "00000000-0000-4000-8000-000000000000", sub: user.id },
    15 * 60,
  );
}

function makeApp() {
  return createMailApp(config);
}

interface ReqOptions {
  body?: unknown;
  token?: string;
}

async function req(
  app: ReturnType<typeof createMailApp>["app"],
  method: string,
  path: string,
  options: ReqOptions = {},
): Promise<{ json: Record<string, any>; status: number }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  const res = await app.request(path, {
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    headers,
    method,
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, any>;
  return { json, status: res.status };
}

describe("mail-api", () => {
  it("health returns ok, unauthenticated and bad-signature requests fail", async () => {
    const ctx = makeApp();
    const health = await req(ctx.app, "GET", "/health");
    assert.equal(health.status, 200);
    assert.equal(health.json.status, "ok");
    const noAuth = await req(ctx.app, "GET", "/mail/mailboxes");
    assert.equal(noAuth.status, 401);
    const badToken = signAccessToken(
      "wrong-secret",
      { email: USER_A.email, role: "user", sid: "x", sub: USER_A.id },
      900,
    );
    const bad = await req(ctx.app, "GET", "/mail/mailboxes", { token: badToken });
    assert.equal(bad.status, 401);
  });

  it("default mailboxes exist for a new user", async () => {
    const ctx = makeApp();
    const res = await req(ctx.app, "GET", "/mail/mailboxes", { token: tokenFor(USER_A) });
    assert.equal(res.status, 200);
    const names = (res.json.mailboxes as Record<string, unknown>[]).map((m) => m.name);
    assert.deepEqual(names, ["Inbox", "Sent", "Drafts", "Archive", "Spam", "Trash"]);
    assert.ok(
      (res.json.mailboxes as Record<string, unknown>[]).every((m) => m.totalEmails === 0),
    );
  });

  it("send -> Sent, inbound -> Inbox, flags, move, trash, purge", async () => {
    const ctx = makeApp();
    const token = tokenFor(USER_A);
    const sent = await req(ctx.app, "POST", "/mail/send", {
      body: {
        bodyText: "Hello Priya, this is a test mail body.",
        subject: "Test subject",
        to: ["priya@dusrel.example"],
      },
      token,
    });
    assert.equal(sent.status, 201);
    const sentId = sent.json.message.id as string;

    const inSent = await req(ctx.app, "GET", "/mail/messages?mailbox=Sent", { token });
    assert.equal((inSent.json.messages as unknown[]).length, 1);

    ctx.jmap.deliverEmail(USER_A.id, {
      bodyText: "Inbound body here.",
      cc: [],
      from: "priya@dusrel.example",
      isFlagged: false,
      isRead: false,
      snippet: "Inbound body here.",
      subject: "Inbound subject",
      to: [USER_A.email],
    });
    const inInbox = await req(ctx.app, "GET", "/mail/messages?mailbox=Inbox", { token });
    assert.equal((inInbox.json.messages as unknown[]).length, 1);
    const inboundId = (inInbox.json.messages as Record<string, string>[])[0].id;

    const search = await req(ctx.app, "GET", "/mail/messages?query=Inbound", { token });
    assert.equal((search.json.messages as unknown[]).length, 1);

    const read = await req(ctx.app, "PATCH", `/mail/messages/${inboundId}`, {
      body: { isFlagged: true, isRead: true },
      token,
    });
    assert.equal(read.status, 200);
    assert.equal(read.json.message.isRead, true);
    assert.equal(read.json.message.isFlagged, true);

    const boxes = await req(ctx.app, "GET", "/mail/mailboxes", { token });
    const archiveId = (boxes.json.mailboxes as Record<string, string>[]).find(
      (m) => m.name === "Archive",
    )?.id;
    assert.ok(archiveId);
    const moved = await req(ctx.app, "PATCH", `/mail/messages/${inboundId}`, {
      body: { mailboxId: archiveId },
      token,
    });
    assert.equal(moved.status, 200);
    assert.equal(moved.json.message.mailboxId, archiveId);

    const trashed = await req(ctx.app, "DELETE", `/mail/messages/${inboundId}`, { token });
    assert.equal(trashed.status, 200);
    assert.equal(trashed.json.purged, false);
    const purged = await req(ctx.app, "DELETE", `/mail/messages/${inboundId}`, { token });
    assert.equal(purged.json.purged, true);
    const gone = await req(ctx.app, "GET", `/mail/messages/${inboundId}`, { token });
    assert.equal(gone.status, 404);
    void sentId;
  });

  it("cross-user isolation: other user's mail is 404, list shows only own mail", async () => {
    const ctx = makeApp();
    const delivered = ctx.jmap.deliverEmail(USER_A.id, {
      bodyText: "Private body.",
      cc: [],
      from: "priya@dusrel.example",
      isFlagged: false,
      isRead: false,
      snippet: "Private body.",
      subject: "Private subject",
      to: [USER_A.email],
    });
    const other = await req(ctx.app, "GET", `/mail/messages/${delivered.id}`, {
      token: tokenFor(USER_B),
    });
    assert.equal(other.status, 404);
    const list = await req(ctx.app, "GET", "/mail/messages", { token: tokenFor(USER_B) });
    assert.equal((list.json.messages as unknown[]).length, 0);
  });

  it("aliases: create, list, duplicate, reserved, wrong domain, limit, delete", async () => {
    const ctx = makeApp();
    const token = tokenFor(USER_A);
    const created = await req(ctx.app, "POST", "/mail/aliases", {
      body: { address: "shop@dusrel.example" },
      token,
    });
    assert.equal(created.status, 201);
    const duplicate = await req(ctx.app, "POST", "/mail/aliases", {
      body: { address: "SHOP@dusrel.example" },
      token,
    });
    assert.equal(duplicate.status, 409);
    const reserved = await req(ctx.app, "POST", "/mail/aliases", {
      body: { address: "support@dusrel.example" },
      token,
    });
    assert.equal(reserved.status, 400);
    const wrongDomain = await req(ctx.app, "POST", "/mail/aliases", {
      body: { address: "shop@other.example" },
      token,
    });
    assert.equal(wrongDomain.status, 400);
    const primary = await req(ctx.app, "POST", "/mail/aliases", {
      body: { address: USER_A.email },
      token,
    });
    assert.equal(primary.status, 400);
    for (let i = 0; i < 9; i += 1) {
      const extra = await req(ctx.app, "POST", "/mail/aliases", {
        body: { address: `alias${i}@dusrel.example` },
        token,
      });
      assert.equal(extra.status, 201);
    }
    const overLimit = await req(ctx.app, "POST", "/mail/aliases", {
      body: { address: "one-too-many@dusrel.example" },
      token,
    });
    assert.equal(overLimit.status, 409);
    const listed = await req(ctx.app, "GET", "/mail/aliases", { token });
    assert.equal((listed.json.aliases as unknown[]).length, 10);
    const aliasId = (listed.json.aliases as Record<string, string>[]).find(
      (a) => a.address === "shop@dusrel.example",
    )?.id;
    assert.ok(aliasId);
    const deleted = await req(ctx.app, "DELETE", `/mail/aliases/${aliasId}`, { token });
    assert.equal(deleted.status, 200);
    const after = await req(ctx.app, "GET", "/mail/aliases", { token });
    assert.equal((after.json.aliases as unknown[]).length, 9);
  });

  it("key directory: publish own key, get it, others' address forbidden, missing 404", async () => {
    const ctx = makeApp();
    const token = tokenFor(USER_A);
    const armored = "-----BEGIN PGP PUBLIC KEY BLOCK-----\ntest\n-----END PGP PUBLIC KEY BLOCK-----";
    const published = await req(ctx.app, "POST", "/mail/keys", {
      body: {
        address: USER_A.email,
        fingerprint: "0123456789abcdef0123456789abcdef01234567",
        publicKeyArmored: armored,
      },
      token,
    });
    assert.equal(published.status, 201);
    const fetched = await req(ctx.app, "GET", `/mail/keys/${encodeURIComponent(USER_A.email)}`, {
      token,
    });
    assert.equal(fetched.status, 200);
    assert.equal(fetched.json.key.publicKeyArmored, armored);
    const forbidden = await req(ctx.app, "POST", "/mail/keys", {
      body: {
        address: USER_B.email,
        fingerprint: "0123456789abcdef0123456789abcdef01234567",
        publicKeyArmored: armored,
      },
      token,
    });
    assert.equal(forbidden.status, 403);
    const missing = await req(ctx.app, "GET", `/mail/keys/${encodeURIComponent(USER_B.email)}`, {
      token,
    });
    assert.equal(missing.status, 404);
    const badFingerprint = await req(ctx.app, "POST", "/mail/keys", {
      body: { address: USER_A.email, fingerprint: "not-hex", publicKeyArmored: armored },
      token,
    });
    assert.equal(badFingerprint.status, 400);
  });
});
