import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashPassword } from "@dusrel/auth";
import { createAuthApp } from "../src/app.js";
import type { AuthConfig } from "../src/config.js";
import { CapturingMailSender } from "../src/mailer.js";
import {
  RETURN_TO_FALLBACK,
  resolveReturnTo,
} from "../src/returnTo.js";
import { InMemoryStore } from "../src/store.js";

const FALLBACK = RETURN_TO_FALLBACK;

describe("return_to validation (docs/28)", () => {
  it("valid host + path pass through unchanged", () => {
    assert.equal(
      resolveReturnTo("https://mail.dusrel.com/inbox", { nodeEnv: "production" }),
      "https://mail.dusrel.com/inbox",
    );
    assert.equal(
      resolveReturnTo("https://mail.dusrel.com/inbox?tab=unread", { nodeEnv: "production" }),
      "https://mail.dusrel.com/inbox?tab=unread",
    );
  });

  it("valid account home passes through", () => {
    assert.equal(
      resolveReturnTo("https://account.dusrel.com/", { nodeEnv: "production" }),
      "https://account.dusrel.com/",
    );
    assert.equal(
      resolveReturnTo("https://dusrel.com", { nodeEnv: "production" }),
      "https://dusrel.com/",
    );
  });

  it("invalid schemes fall back (javascript:, data:, protocol-relative)", () => {
    assert.equal(resolveReturnTo("javascript:alert(1)", { nodeEnv: "production" }), FALLBACK);
    assert.equal(resolveReturnTo("data:text/html,hi", { nodeEnv: "production" }), FALLBACK);
    assert.equal(resolveReturnTo("//evil.com/inbox", { nodeEnv: "production" }), FALLBACK);
    assert.equal(resolveReturnTo("https://evil.com/inbox", { nodeEnv: "production" }), FALLBACK);
  });

  it("http in production falls back, even for allowed hosts", () => {
    assert.equal(
      resolveReturnTo("http://mail.dusrel.com/inbox", { nodeEnv: "production" }),
      FALLBACK,
    );
  });

  it("suffix tricks fall back (exact host match only)", () => {
    assert.equal(
      resolveReturnTo("https://mail.dusrel.com.evil.com/inbox", { nodeEnv: "production" }),
      FALLBACK,
    );
    assert.equal(
      resolveReturnTo("https://dusrel.com.evil.com/", { nodeEnv: "production" }),
      FALLBACK,
    );
    assert.equal(
      resolveReturnTo("https://evil-dusrel.com/inbox", { nodeEnv: "production" }),
      FALLBACK,
    );
  });

  it("userinfo tricks fall back", () => {
    assert.equal(
      resolveReturnTo("https://mail.dusrel.com@evil.com/inbox", { nodeEnv: "production" }),
      FALLBACK,
    );
    assert.equal(
      resolveReturnTo("https://evil.com@mail.dusrel.com/inbox", { nodeEnv: "production" }),
      FALLBACK,
    );
  });

  it("// path falls back (protocol-relative path trick)", () => {
    assert.equal(
      resolveReturnTo("https://mail.dusrel.com//evil.com", { nodeEnv: "production" }),
      FALLBACK,
    );
  });

  it("double-decode trick falls back", () => {
    assert.equal(
      resolveReturnTo("https://mail.dusrel.com/%252F%252Fevil.com", { nodeEnv: "production" }),
      FALLBACK,
    );
  });

  it("missing, empty, or malformed input falls back — never an error", () => {
    assert.equal(resolveReturnTo(undefined, { nodeEnv: "production" }), FALLBACK);
    assert.equal(resolveReturnTo("", { nodeEnv: "production" }), FALLBACK);
    assert.equal(resolveReturnTo(null, { nodeEnv: "production" }), FALLBACK);
    assert.equal(resolveReturnTo("not a url at all", { nodeEnv: "production" }), FALLBACK);
    assert.equal(resolveReturnTo("https://mail.dusrel.com/%E0%A4%A", { nodeEnv: "production" }), FALLBACK);
  });

  it("env override: localhost http allowed in dev only when env lists localhost", () => {
    const previous = process.env.AUTH_RETURN_TO_HOSTS;
    try {
      process.env.AUTH_RETURN_TO_HOSTS = "localhost,mail.dusrel.com";
      assert.equal(
        resolveReturnTo("http://localhost:3000/inbox", { nodeEnv: "development" }),
        "http://localhost:3000/inbox",
      );
      // Production me env me localhost hone par bhi http mana hai.
      assert.equal(
        resolveReturnTo("http://localhost:3000/inbox", { nodeEnv: "production" }),
        FALLBACK,
      );
      // Env hatane par default list lagti hai — usme localhost nahi hai.
      delete process.env.AUTH_RETURN_TO_HOSTS;
      assert.equal(
        resolveReturnTo("http://localhost:3000/inbox", { nodeEnv: "development" }),
        FALLBACK,
      );
    } finally {
      if (previous === undefined) {
        delete process.env.AUTH_RETURN_TO_HOSTS;
      } else {
        process.env.AUTH_RETURN_TO_HOSTS = previous;
      }
    }
  });
});

describe("login endpoint redirectTo", () => {
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

  async function loginWithReturnTo(returnTo: string | undefined) {
    const store = new InMemoryStore();
    const { app } = createAuthApp(config, store, new CapturingMailSender());
    store.createUser({
      displayName: "Owner",
      email: "owner@dusrel.example",
      passwordHash: await hashPassword("Owner-Password-123"),
      quotaGb: 5,
      role: "owner",
      status: "active",
      suspendedUntil: null,
    });
    const body: Record<string, unknown> = {
      email: "owner@dusrel.example",
      password: "Owner-Password-123",
    };
    if (returnTo !== undefined) {
      body.returnTo = returnTo;
    }
    const res = await app.request("/auth/login", {
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const json = (await res.json()) as Record<string, unknown>;
    return { json, status: res.status };
  }

  it("valid return_to gives redirectTo, other fields unchanged", async () => {
    const { json, status } = await loginWithReturnTo("https://mail.dusrel.com/inbox");
    assert.equal(status, 200);
    assert.equal(json.redirectTo, "https://mail.dusrel.com/inbox");
    assert.equal(typeof json.accessToken, "string");
    assert.equal(typeof json.refreshToken, "string");
    assert.equal((json.user as Record<string, unknown>).email, "owner@dusrel.example");
  });

  it("missing return_to gives fallback, login still succeeds", async () => {
    const { json, status } = await loginWithReturnTo(undefined);
    assert.equal(status, 200);
    assert.equal(json.redirectTo, FALLBACK);
  });

  it("evil return_to gives fallback, login still succeeds (no error)", async () => {
    const { json, status } = await loginWithReturnTo("https://evil.com/inbox");
    assert.equal(status, 200);
    assert.equal(json.redirectTo, FALLBACK);
  });
});
