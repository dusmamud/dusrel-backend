import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AuthConfig } from "./config.js";
import type { MailSender } from "./mailer.js";
import { createAdminRoutes } from "./routes/admin.js";
import { createAuthRoutes } from "./routes/auth.js";
import { ApiError, AuthService } from "./services/authService.js";
import { InMemoryStore } from "./store.js";

export interface AuthApp {
  app: Hono;
  service: AuthService;
  store: InMemoryStore;
}

/**
 * App factory. Tests build the app with a fresh InMemoryStore and a
 * CapturingMailSender and call app.request() — no network needed.
 * The production entry (src/index.ts) uses the same factory with a
 * LogMailSender.
 */
export function createAuthApp(
  config: AuthConfig,
  store: InMemoryStore = new InMemoryStore(),
  mailer: MailSender,
): AuthApp {
  const service = new AuthService(store, mailer, config);
  const app = new Hono();

  app.use(
    cors({
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
      credentials: true,
      origin: config.corsOrigin,
    }),
  );

  app.get("/health", (c) =>
    c.json({ service: "auth-api", status: "ok", version: "0.1.0" }),
  );

  app.route("/", createAuthRoutes(store, config, service));
  app.route("/", createAdminRoutes(store, config, service));

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json({ code: err.code, error: err.message }, err.status as 400);
    }
    console.error("[auth-api] unexpected error", err);
    return c.json({ code: "internal_error", error: "Internal server error" }, 500);
  });

  app.notFound((c) => c.json({ code: "not_found", error: "Not found" }, 404));

  return { app, service, store };
}
