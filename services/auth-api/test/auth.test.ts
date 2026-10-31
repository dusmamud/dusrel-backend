import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPassword, totpCode } from "@dusrel/auth";
import { createAuthApp } from "../src/app.js";
import type { AuthConfig } from "../src/config.js";
import { CapturingMailSender } from "../src/mailer.js";
import { InMemoryStore } from "../src/store.js";

const config: AuthConfig = {
  accessTokenTtlSeconds: 15 * 60,
  appUrl: "http://localhost:3000",
  corsOrigin: "*",
  inviteTtlSeconds: 24 * 60 * 60,
  jwtSecret: "test-secret-do-not-use-in-production",
  otpMaxAttempts: 5,
  otpTtlSeconds: 10 * 60,
  port: 3001,
  refreshTokenTtlSeconds: 30 * 24 * 60 * 60,
  resetTokenTtlSeconds: 60 * 60,
};

function makeApp() {
  const store = new InMemoryStore();
  const mailer = new CapturingMailSender();
  const { app, service } = createAuthApp(config, store, mailer);
  return { app, mailer, service, store };
}

interface ReqOptions {
  body?: unknown;
  token?: string;
}

async function req(
  app: ReturnType<typeof createAuthApp>["app"],
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

async function seedOwner(appCtx: ReturnType<typeof makeApp>) {
  const { store } = appCtx;
  store.createUser({
    displayName: "Owner",
    email: "owner@dusrel.example",
    passwordHash: await hashPassword("Owner-Password-123"),
    quotaGb: 5,
    role: "owner",
    status: "active",
    suspendedUntil: null,
  });
  const login = await req(appCtx.app, "POST", "/auth/login", {
    body: { email: "owner@dusrel.example", password: "Owner-Password-123" },
  });
  assert.equal(login.status, 200);
  return login.json.accessToken as string;
}

function tokenFromMail(text: string): string {
  const match = /token=([a-f0-9]+)/.exec(text);
  assert.ok(match, `expected a token in mail text, got: ${text}`);
  return match[1];
}

function codeFromMail(text: string): string {
  const match = /code is (\d{6})/.exec(text);
  assert.ok(match, `expected a code in mail text, got: ${text}`);
  return match[1];
}

describe("auth-api", () => {
  it("health returns ok", async () => {
    const ctx = makeApp();
    const res = await req(ctx.app, "GET", "/health");
    assert.equal(res.status, 200);
    assert.equal(res.json.status, "ok");
  });

  it("admin invite -> accept -> login, invite reuse fails", async () => {
    const ctx = makeApp();
    const ownerToken = await seedOwner(ctx);
    const created = await req(ctx.app, "POST", "/admin/users", {
      body: {
        displayName: "Arav",
        email: "arav@dusrel.example",
        role: "user",
      },
      token: ownerToken,
    });
    assert.equal(created.status, 201);
    const inviteMail = ctx.mailer.lastTo("arav@dusrel.example");
    assert.ok(inviteMail);
    const token = tokenFromMail(inviteMail.text);
    const accepted = await req(ctx.app, "POST", "/auth/invite/accept", {
      body: { password: "User-Password-123", passwordConfirm: "User-Password-123", token },
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.json.user.status, "active");
    const login = await req(ctx.app, "POST", "/auth/login", {
      body: { email: "arav@dusrel.example", password: "User-Password-123" },
    });
    assert.equal(login.status, 200);
    assert.ok(login.json.accessToken);
    const reuse = await req(ctx.app, "POST", "/auth/invite/accept", {
      body: { password: "User-Password-123", passwordConfirm: "User-Password-123", token },
    });
    assert.equal(reuse.status, 400);
  });

  it("admin create rejects reserved and duplicate addresses", async () => {
    const ctx = makeApp();
    const ownerToken = await seedOwner(ctx);
    const reserved = await req(ctx.app, "POST", "/admin/users", {
      body: { displayName: "Postmaster", email: "postmaster@dusrel.example", role: "user" },
      token: ownerToken,
    });
    assert.equal(reserved.status, 400);
    const first = await req(ctx.app, "POST", "/admin/users", {
      body: { displayName: "Arav", email: "arav@dusrel.example", role: "user" },
      token: ownerToken,
    });
    assert.equal(first.status, 201);
    const duplicate = await req(ctx.app, "POST", "/admin/users", {
      body: { displayName: "Arav 2", email: "ARAV@dusrel.example", role: "user" },
      token: ownerToken,
    });
    assert.equal(duplicate.status, 409);
  });

  it("login failure is generic and forgot does not enumerate", async () => {
    const ctx = makeApp();
    const ownerToken = await seedOwner(ctx);
    const bad = await req(ctx.app, "POST", "/auth/login", {
      body: { email: "owner@dusrel.example", password: "wrong-password" },
    });
    assert.equal(bad.status, 401);
    assert.equal(bad.json.error, "Invalid email or password");
    const missing = await req(ctx.app, "POST", "/auth/login", {
      body: { email: "nobody@dusrel.example", password: "wrong-password" },
    });
    assert.equal(missing.status, 401);
    assert.equal(missing.json.error, "Invalid email or password");
    const forgotMissing = await req(ctx.app, "POST", "/auth/forgot-password", {
      body: { email: "nobody@dusrel.example" },
    });
    const forgotOwner = await req(ctx.app, "POST", "/auth/forgot-password", {
      body: { email: "owner@dusrel.example" },
    });
    assert.equal(forgotMissing.status, 200);
    assert.equal(forgotOwner.status, 200);
    assert.equal(forgotMissing.json.message, forgotOwner.json.message);
    assert.equal(ctx.mailer.messages.length, 0);
    void ownerToken;
  });

  it("forgot -> reset via secondary email, no auto-login, token single-use", async () => {
    const ctx = makeApp();
    const ownerToken = await seedOwner(ctx);
    // Owner adds + verifies a secondary email.
    await req(ctx.app, "POST", "/auth/secondary-emails", {
      body: { email: "owner-recovery@other.example" },
      token: ownerToken,
    });
    const otpMail = ctx.mailer.lastTo("owner-recovery@other.example");
    assert.ok(otpMail);
    const verified = await req(ctx.app, "POST", "/auth/secondary-emails/verify", {
      body: { code: codeFromMail(otpMail.text), email: "owner-recovery@other.example" },
      token: ownerToken,
    });
    assert.equal(verified.status, 200);

    const forgot = await req(ctx.app, "POST", "/auth/forgot-password", {
      body: { email: "owner@dusrel.example" },
    });
    assert.equal(forgot.status, 200);
    const resetMail = ctx.mailer.lastTo("owner-recovery@other.example");
    assert.ok(resetMail);
    // The reset link must NOT go to the locked-out Dusrel mailbox.
    assert.ok(!ctx.mailer.messages.some((m) => m.to === "owner@dusrel.example"));
    const token = tokenFromMail(resetMail.text);
    const reset = await req(ctx.app, "POST", "/auth/reset-password", {
      body: {
        newPassword: "Owner-New-Password-123",
        newPasswordConfirm: "Owner-New-Password-123",
        token,
      },
    });
    assert.equal(reset.status, 200);
    assert.equal(reset.json.accessToken, undefined);
    assert.equal(reset.json.refreshToken, undefined);
    const reuse = await req(ctx.app, "POST", "/auth/reset-password", {
      body: {
        newPassword: "Owner-New-Password-123",
        newPasswordConfirm: "Owner-New-Password-123",
        token,
      },
    });
    assert.equal(reuse.status, 400);
    const loginNew = await req(ctx.app, "POST", "/auth/login", {
      body: { email: "owner@dusrel.example", password: "Owner-New-Password-123" },
    });
    assert.equal(loginNew.status, 200);
    const loginOld = await req(ctx.app, "POST", "/auth/login", {
      body: { email: "owner@dusrel.example", password: "Owner-Password-123" },
    });
    assert.equal(loginOld.status, 401);
  });

  it("secondary email OTP: wrong codes fail, 5 failures invalidate the record", async () => {
    const ctx = makeApp();
    const ownerToken = await seedOwner(ctx);
    await req(ctx.app, "POST", "/auth/secondary-emails", {
      body: { email: "second@other.example" },
      token: ownerToken,
    });
    const otpMail = ctx.mailer.lastTo("second@other.example");
    assert.ok(otpMail);
    const good = codeFromMail(otpMail.text);
    for (let i = 0; i < 5; i += 1) {
      const wrong = await req(ctx.app, "POST", "/auth/secondary-emails/verify", {
        body: { code: "000000", email: "second@other.example" },
        token: ownerToken,
      });
      assert.equal(wrong.status, 400);
    }
    const afterExhaustion = await req(ctx.app, "POST", "/auth/secondary-emails/verify", {
      body: { code: good, email: "second@other.example" },
      token: ownerToken,
    });
    assert.notEqual(afterExhaustion.status, 200);
  });

  it("password change invalidates all sessions when asked", async () => {
    const ctx = makeApp();
    const ownerToken = await seedOwner(ctx);
    const changed = await req(ctx.app, "POST", "/auth/password/change", {
      body: {
        currentPassword: "Owner-Password-123",
        invalidateAllSessions: true,
        newPassword: "Owner-Changed-123",
        newPasswordConfirm: "Owner-Changed-123",
      },
      token: ownerToken,
    });
    assert.equal(changed.status, 200);
    const oldSession = await req(ctx.app, "GET", "/auth/sessions", { token: ownerToken });
    assert.equal(oldSession.status, 401);
    const login = await req(ctx.app, "POST", "/auth/login", {
      body: { email: "owner@dusrel.example", password: "Owner-Changed-123" },
    });
    assert.equal(login.status, 200);
  });

  it("TOTP: setup, verify, login with code, backup code single-use", async () => {
    const ctx = makeApp();
    const ownerToken = await seedOwner(ctx);
    const setup = await req(ctx.app, "POST", "/auth/totp/setup", { token: ownerToken });
    assert.equal(setup.status, 200);
    assert.ok(setup.json.secret);
    const code = totpCode(setup.json.secret as string);
    const verify = await req(ctx.app, "POST", "/auth/totp/verify", {
      body: { code },
      token: ownerToken,
    });
    assert.equal(verify.status, 200);
    assert.equal((verify.json.backupCodes as string[]).length, 10);
    const backupCode = (verify.json.backupCodes as string[])[0];

    const noCode = await req(ctx.app, "POST", "/auth/login", {
      body: { email: "owner@dusrel.example", password: "Owner-Password-123" },
    });
    assert.equal(noCode.status, 401);
    assert.equal(noCode.json.code, "totp_required");

    const withCode = await req(ctx.app, "POST", "/auth/login", {
      body: {
        email: "owner@dusrel.example",
        password: "Owner-Password-123",
        totpCode: totpCode(setup.json.secret as string),
      },
    });
    assert.equal(withCode.status, 200);

    const withBackup = await req(ctx.app, "POST", "/auth/login", {
      body: { email: "owner@dusrel.example", password: "Owner-Password-123", backupCode },
    });
    assert.equal(withBackup.status, 200);

    const backupReuse = await req(ctx.app, "POST", "/auth/login", {
      body: { email: "owner@dusrel.example", password: "Owner-Password-123", backupCode },
    });
    assert.equal(backupReuse.status, 401);
  });

  it("app passwords: created once, listed without secret, revoked", async () => {
    const ctx = makeApp();
    const ownerToken = await seedOwner(ctx);
    const owner = ctx.store.getUserByEmail("owner@dusrel.example");
    assert.ok(owner);
    const created = await req(ctx.app, "POST", "/auth/app-passwords", {
      body: { name: "Thunderbird" },
      token: ownerToken,
    });
    assert.equal(created.status, 201);
    assert.ok(created.json.password);
    const listed = await req(ctx.app, "GET", "/auth/app-passwords", { token: ownerToken });
    assert.equal(listed.status, 200);
    assert.equal((listed.json.appPasswords as unknown[]).length, 1);
    assert.equal(
      (listed.json.appPasswords as Record<string, unknown>[])[0].password,
      undefined,
    );
    assert.equal(
      await ctx.service.verifyAppPassword(owner.id, created.json.password as string),
      true,
    );
    const revoked = await req(ctx.app, "DELETE", `/auth/app-passwords/${created.json.id}`, {
      token: ownerToken,
    });
    assert.equal(revoked.status, 200);
    assert.equal(
      await ctx.service.verifyAppPassword(owner.id, created.json.password as string),
      false,
    );
  });

  it("sessions list and revoke, admin suspend -> 403 -> reactivate", async () => {
    const ctx = makeApp();
    const ownerToken = await seedOwner(ctx);
    const created = await req(ctx.app, "POST", "/admin/users", {
      body: { displayName: "Arav", email: "arav@dusrel.example", role: "user" },
      token: ownerToken,
    });
    assert.equal(created.status, 201);
    const inviteMail = ctx.mailer.lastTo("arav@dusrel.example");
    assert.ok(inviteMail);
    await req(ctx.app, "POST", "/auth/invite/accept", {
      body: {
        password: "User-Password-123",
        passwordConfirm: "User-Password-123",
        token: tokenFromMail(inviteMail.text),
      },
    });
    const login1 = await req(ctx.app, "POST", "/auth/login", {
      body: { email: "arav@dusrel.example", password: "User-Password-123" },
    });
    const login2 = await req(ctx.app, "POST", "/auth/login", {
      body: { email: "arav@dusrel.example", password: "User-Password-123" },
    });
    const sessions = await req(ctx.app, "GET", "/auth/sessions", {
      token: login1.json.accessToken as string,
    });
    assert.equal((sessions.json.sessions as unknown[]).length, 2);
    const sessionToRevoke = (sessions.json.sessions as Record<string, string>[])[0].id;
    const revoked = await req(ctx.app, "DELETE", `/auth/sessions/${sessionToRevoke}`, {
      token: login2.json.accessToken as string,
    });
    assert.equal(revoked.status, 200);

    const userId = created.json.user.id as string;
    const suspended = await req(ctx.app, "POST", `/admin/users/${userId}/state`, {
      body: { reason: "spam investigation", state: "suspended" },
      token: ownerToken,
    });
    assert.equal(suspended.status, 200);
    const loginSuspended = await req(ctx.app, "POST", "/auth/login", {
      body: { email: "arav@dusrel.example", password: "User-Password-123" },
    });
    assert.equal(loginSuspended.status, 403);
    const reactivated = await req(ctx.app, "POST", `/admin/users/${userId}/state`, {
      body: { reason: "cleared", state: "active" },
      token: ownerToken,
    });
    assert.equal(reactivated.status, 200);
    const loginAgain = await req(ctx.app, "POST", "/auth/login", {
      body: { email: "arav@dusrel.example", password: "User-Password-123" },
    });
    assert.equal(loginAgain.status, 200);

    const audit = await req(ctx.app, "GET", "/admin/audit-log", { token: ownerToken });
    assert.equal(audit.status, 200);
    assert.ok((audit.json.entries as unknown[]).length > 0);
    assert.ok(
      !(JSON.stringify(audit.json).includes("User-Password-123")),
      "audit log must never contain a password",
    );
  });

  it("admin cannot change an owner account", async () => {
    const ctx = makeApp();
    const ownerToken = await seedOwner(ctx);
    // Note: "admin@" itself is a reserved address, so the admin-role
    // user gets a normal (non-reserved) address here.
    const adminCreated = await req(ctx.app, "POST", "/admin/users", {
      body: { displayName: "Admin", email: "priya@dusrel.example", role: "admin" },
      token: ownerToken,
    });
    assert.equal(adminCreated.status, 201);
    const inviteMail = ctx.mailer.lastTo("priya@dusrel.example");
    assert.ok(inviteMail);
    await req(ctx.app, "POST", "/auth/invite/accept", {
      body: {
        password: "Admin-Password-123",
        passwordConfirm: "Admin-Password-123",
        token: tokenFromMail(inviteMail.text),
      },
    });
    const adminLogin = await req(ctx.app, "POST", "/auth/login", {
      body: { email: "priya@dusrel.example", password: "Admin-Password-123" },
    });
    const owner = ctx.store.getUserByEmail("owner@dusrel.example");
    assert.ok(owner);
    const attempt = await req(ctx.app, "POST", `/admin/users/${owner.id}/state`, {
      body: { reason: "test", state: "suspended" },
      token: adminLogin.json.accessToken as string,
    });
    assert.equal(attempt.status, 403);
  });
});
