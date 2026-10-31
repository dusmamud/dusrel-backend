import { verifyAccessToken } from "@dusrel/auth";
import type { Context, Next } from "hono";
import type { AuthConfig } from "../config.js";
import type { InMemoryStore, Session, User } from "../store.js";

export interface AuthContext {
  claims: { role: string; sid: string; sub: string };
  session: Session;
  user: User;
}

/**
 * Bearer JWT auth. The access token alone is not trusted: the session
 * it names must still exist and not be revoked, so logout / revoke /
 * suspension take effect before the 15-minute access token expires.
 * A non-active account gets 403, not 401 (docs/28).
 */
export function authMiddleware(store: InMemoryStore, config: AuthConfig) {
  return async (c: Context, next: Next) => {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      return c.json({ code: "unauthorized", error: "Missing bearer token" }, 401);
    }
    const claims = verifyAccessToken(config.jwtSecret, header.slice("Bearer ".length));
    if (!claims) {
      return c.json({ code: "unauthorized", error: "Invalid or expired token" }, 401);
    }
    const session = store.sessions.get(claims.sid);
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      return c.json({ code: "unauthorized", error: "Session is revoked" }, 401);
    }
    const user = store.getUserById(claims.sub);
    if (!user) {
      return c.json({ code: "unauthorized", error: "User not found" }, 401);
    }
    if (user.status !== "active") {
      return c.json(
        { code: "account_not_active", error: `Account is ${user.status}` },
        403,
      );
    }
    c.set("auth", { claims, session, user } satisfies AuthContext);
    await next();
  };
}

export function getAuth(c: Context): AuthContext {
  return c.get("auth") as AuthContext;
}

export function requireRole(...roles: string[]) {
  return async (c: Context, next: Next) => {
    const auth = getAuth(c);
    if (!roles.includes(auth.user.role)) {
      return c.json({ code: "forbidden", error: "This role cannot do that" }, 403);
    }
    await next();
  };
}
