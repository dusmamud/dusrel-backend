import { verifyAccessToken } from "@dusrel/auth";
import type { AccessTokenClaims } from "@dusrel/auth";
import type { Context, Next } from "hono";
import type { MailConfig } from "../config.js";

export interface MailAuthContext {
  claims: AccessTokenClaims;
}

/**
 * Bearer JWT auth for mail-api.
 *
 * LIMIT, stated plainly: this verifies signature + expiry ONLY.
 * It cannot check whether the session was revoked or the account
 * was suspended after the token was issued, because auth-api's
 * sessions live in auth-api's in-memory store, which mail-api
 * cannot see. The window for a revoked token is bounded by the
 * 15-minute access-token TTL. The fix is shared storage (Postgres
 * after ADR-004) or a token-introspection endpoint on auth-api —
 * both are later steps, not this slice. Never present mail-api
 * auth as equivalent to auth-api's session-checked auth.
 */
export function mailAuthMiddleware(config: MailConfig) {
  return async (c: Context, next: Next) => {
    const header = c.req.header("Authorization");
    if (!header?.startsWith("Bearer ")) {
      return c.json({ code: "unauthorized", error: "Missing bearer token" }, 401);
    }
    const claims = verifyAccessToken(config.jwtSecret, header.slice("Bearer ".length));
    if (!claims) {
      return c.json({ code: "unauthorized", error: "Invalid or expired token" }, 401);
    }
    c.set("mailAuth", { claims } satisfies MailAuthContext);
    await next();
  };
}

export function getMailAuth(c: Context): MailAuthContext {
  return c.get("mailAuth") as MailAuthContext;
}
