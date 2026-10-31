import {
  appPasswordCreateSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  inviteAcceptSchema,
  loginSchema,
  refreshSchema,
  resetPasswordSchema,
  totpDisableSchema,
  totpVerifySchema,
} from "@dusrel/api-contracts";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware, getAuth } from "../middleware/auth.js";
import { RateLimiter } from "../rateLimit.js";
import { ApiError, AuthService } from "../services/authService.js";
import type { InMemoryStore } from "../store.js";
import type { AuthConfig } from "../config.js";

function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError(400, "validation_error", result.error.issues[0]?.message ?? "Invalid input");
  }
  return result.data;
}

function clientIp(c: { req: { header: (n: string) => string | undefined } }): string | null {
  // Behind Caddy/Render, X-Forwarded-For is the client IP. In v1 this
  // is trusted as-is because the service runs behind one proxy; do
  // not expose this service directly to the internet without a proxy.
  const forwarded = c.req.header("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() ?? null;
}

export function createAuthRoutes(
  store: InMemoryStore,
  config: AuthConfig,
  service: AuthService,
): Hono {
  const app = new Hono();
  const auth = authMiddleware(store, config);

  // Rate limits are starting values (docs/22, 27), per-bucket:
  // login has separate per-email and per-IP buckets (never combined).
  const loginEmailLimiter = new RateLimiter(15 * 60 * 1000, 10);
  const loginIpLimiter = new RateLimiter(15 * 60 * 1000, 50);
  const forgotEmailLimiter = new RateLimiter(60 * 60 * 1000, 5);
  const forgotIpLimiter = new RateLimiter(60 * 60 * 1000, 20);

  app.post("/auth/login", async (c) => {
    const body = parseBody(loginSchema, await c.req.json().catch(() => null));
    const ip = clientIp(c);
    const emailKey = body.email.toLowerCase();
    if (!loginEmailLimiter.allow(`email:${emailKey}`) || (ip && !loginIpLimiter.allow(`ip:${ip}`))) {
      return c.json({ code: "too_many_requests", error: "Too many login attempts" }, 429);
    }
    const result = await service.login({
      backupCode: body.backupCode,
      email: body.email,
      ip,
      password: body.password,
      totpCode: body.totpCode,
      userAgent: c.req.header("user-agent") ?? null,
    });
    // Flat shape for clients: accessToken + refreshToken + user.
    return c.json({ ...result.tokens, user: result.user });
  });

  app.post("/auth/refresh", async (c) => {
    const body = parseBody(refreshSchema, await c.req.json().catch(() => null));
    const tokens = await service.refresh({
      ip: clientIp(c),
      refreshToken: body.refreshToken,
      userAgent: c.req.header("user-agent") ?? null,
    });
    return c.json(tokens);
  });

  app.post("/auth/logout", auth, async (c) => {
    service.logout(getAuth(c).session.id);
    return c.json({ ok: true });
  });

  app.get("/auth/sessions", auth, async (c) => {
    return c.json({ sessions: service.listSessions(getAuth(c).user.id) });
  });

  app.delete("/auth/sessions", auth, async (c) => {
    service.revokeAllSessions(getAuth(c).user.id);
    return c.json({ ok: true });
  });

  app.delete("/auth/sessions/:id", auth, async (c) => {
    service.revokeSession(getAuth(c).user.id, c.req.param("id") ?? "");
    return c.json({ ok: true });
  });

  app.post("/auth/password/change", auth, async (c) => {
    const body = parseBody(changePasswordSchema, await c.req.json().catch(() => null));
    await service.changePassword({
      currentPassword: body.currentPassword,
      invalidateAllSessions: body.invalidateAllSessions,
      newPassword: body.newPassword,
      userId: getAuth(c).user.id,
    });
    return c.json({ ok: true });
  });

  app.post("/auth/forgot-password", async (c) => {
    const body = parseBody(forgotPasswordSchema, await c.req.json().catch(() => null));
    const ip = clientIp(c);
    const emailKey = body.email.toLowerCase();
    if (!forgotEmailLimiter.allow(`email:${emailKey}`) || (ip && !forgotIpLimiter.allow(`ip:${ip}`))) {
      // Same generic 429 for everyone; never reveal which bucket fired.
      return c.json({ code: "too_many_requests", error: "Too many requests" }, 429);
    }
    const result = await service.forgotPassword(body.email);
    return c.json(result);
  });

  app.post("/auth/reset-password", async (c) => {
    const body = parseBody(resetPasswordSchema, await c.req.json().catch(() => null));
    await service.resetPassword({ newPassword: body.newPassword, token: body.token });
    return c.json({ ok: true });
  });

  app.post("/auth/secondary-emails", auth, async (c) => {
    const body = parseBody(
      z.object({ email: z.string().trim().min(1).max(255).email() }),
      await c.req.json().catch(() => null),
    );
    await service.requestSecondaryEmailOtp(getAuth(c).user.id, body.email);
    return c.json({ ok: true });
  });

  app.post("/auth/secondary-emails/verify", auth, async (c) => {
    const body = parseBody(
      z.object({
        code: z.string().regex(/^\d{6}$/),
        email: z.string().trim().min(1).max(255).email(),
      }),
      await c.req.json().catch(() => null),
    );
    service.verifySecondaryEmailOtp(getAuth(c).user.id, body.email, body.code);
    return c.json({ ok: true });
  });

  app.get("/auth/secondary-emails", auth, async (c) => {
    return c.json({ secondaryEmails: service.listSecondaryEmails(getAuth(c).user.id) });
  });

  app.post("/auth/totp/setup", auth, async (c) => {
    return c.json(service.totpSetup(getAuth(c).user.id));
  });

  app.post("/auth/totp/verify", auth, async (c) => {
    const body = parseBody(totpVerifySchema, await c.req.json().catch(() => null));
    const result = await service.totpVerify(getAuth(c).user.id, body.code);
    return c.json(result);
  });

  app.post("/auth/totp/disable", auth, async (c) => {
    const body = parseBody(totpDisableSchema, await c.req.json().catch(() => null));
    await service.totpDisable({
      backupCode: body.backupCode,
      password: body.password,
      totpCode: body.totpCode,
      userId: getAuth(c).user.id,
    });
    return c.json({ ok: true });
  });

  app.post("/auth/app-passwords", auth, async (c) => {
    const body = parseBody(appPasswordCreateSchema, await c.req.json().catch(() => null));
    const result = await service.createAppPassword(getAuth(c).user.id, body.name);
    return c.json(result, 201);
  });

  app.get("/auth/app-passwords", auth, async (c) => {
    return c.json({ appPasswords: service.listAppPasswords(getAuth(c).user.id) });
  });

  app.delete("/auth/app-passwords/:id", auth, async (c) => {
    service.revokeAppPassword(getAuth(c).user.id, c.req.param("id") ?? "");
    return c.json({ ok: true });
  });

  app.post("/auth/invite/accept", async (c) => {
    const body = parseBody(inviteAcceptSchema, await c.req.json().catch(() => null));
    const user = await service.inviteAccept(body.token, body.password);
    return c.json({ user });
  });

  return app;
}
