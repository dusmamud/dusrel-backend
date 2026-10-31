import { adminCreateUserSchema, adminUserStateSchema } from "@dusrel/api-contracts";
import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware, getAuth, requireRole } from "../middleware/auth.js";
import { ApiError, AuthService } from "../services/authService.js";
import type { AuthConfig } from "../config.js";
import type { InMemoryStore } from "../store.js";

function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError(400, "validation_error", result.error.issues[0]?.message ?? "Invalid input");
  }
  return result.data;
}

/**
 * Admin router (docs/28). Only Owner and Admin roles. Support is
 * read-only in the docs and has no write endpoint here yet.
 * No endpoint in this router ever returns a mail body, private key,
 * seed, password, or token — the audit log carries metadata only.
 */
export function createAdminRoutes(
  store: InMemoryStore,
  config: AuthConfig,
  service: AuthService,
): Hono {
  const app = new Hono();
  const auth = authMiddleware(store, config);
  const adminOnly = requireRole("owner", "admin");

  app.use(auth);
  app.use(adminOnly);

  app.post("/admin/users", async (c) => {
    const body = parseBody(adminCreateUserSchema, await c.req.json().catch(() => null));
    const result = service.adminCreateUser({
      actor: getAuth(c).user,
      displayName: body.displayName,
      email: body.email,
      quotaGb: body.quotaGb,
      role: body.role,
    });
    return c.json(result, 201);
  });

  app.get("/admin/users", async (c) => {
    return c.json({ users: service.adminListUsers() });
  });

  app.post("/admin/users/:id/state", async (c) => {
    const body = parseBody(adminUserStateSchema, await c.req.json().catch(() => null));
    const user = service.adminSetUserState({
      actor: getAuth(c).user,
      reason: body.reason,
      state: body.state,
      suspendedUntil: body.suspendedUntil ? new Date(body.suspendedUntil) : null,
      targetId: c.req.param("id") ?? "",
    });
    return c.json({ user });
  });

  app.delete("/admin/users/:id", async (c) => {
    service.adminDeleteUser(getAuth(c).user, c.req.param("id") ?? "");
    return c.json({ ok: true });
  });

  app.get("/admin/audit-log", async (c) => {
    return c.json({ entries: service.adminAuditLog() });
  });

  return app;
}
