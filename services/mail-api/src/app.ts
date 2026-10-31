import { Hono } from "hono";
import { cors } from "hono/cors";
import type { MailConfig } from "./config.js";
import { InMemoryJmapClient } from "./fakeJmap.js";
import type { JmapClient } from "./jmap.js";
import { createMailRoutes } from "./routes/mail.js";
import { ApiError, MailService } from "./services/mailService.js";
import { MailStore } from "./store.js";

export interface MailApp {
  app: Hono;
  jmap: InMemoryJmapClient;
  service: MailService;
  store: MailStore;
}

/**
 * App factory. Tests build the app with fresh stores and call
 * app.request() — no network, no Stalwart needed. The production
 * entry (src/index.ts) uses the same factory with the in-memory
 * JMAP client until the real Stalwart JMAP client lands.
 */
export function createMailApp(
  config: MailConfig,
  jmap: JmapClient = new InMemoryJmapClient(),
  store: MailStore = new MailStore(),
): MailApp {
  const service = new MailService(jmap, store);
  const app = new Hono();

  app.use(
    cors({
      allowHeaders: ["Authorization", "Content-Type"],
      // PUT isliye hai kyunki /mail/settings PUT se update hota
      // hai — bina iske browser se settings save karne par CORS
      // preflight fail hota.
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
      origin: config.corsOrigin,
    }),
  );

  app.get("/health", (c) =>
    c.json({ service: "mail-api", status: "ok", version: "0.1.0" }),
  );

  app.route("/", createMailRoutes(config, service));

  app.onError((err, c) => {
    if (err instanceof ApiError) {
      return c.json({ code: err.code, error: err.message }, err.status as 400);
    }
    console.error("[mail-api] unexpected error", err);
    return c.json({ code: "internal_error", error: "Internal server error" }, 500);
  });

  app.notFound((c) => c.json({ code: "not_found", error: "Not found" }, 404));

  return {
    app,
    jmap: jmap as InMemoryJmapClient,
    service,
    store,
  };
}
