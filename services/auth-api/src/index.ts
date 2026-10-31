import { serve } from "@hono/node-server";
import { createAuthApp } from "./app.js";
import { loadConfig } from "./config.js";
import { LogMailSender } from "./mailer.js";
import { InMemoryStore } from "./store.js";

/**
 * Production-shaped entry, v1 store reality: InMemoryStore + LogMailSender.
 * See CODE-README.md limits — this is NOT a production auth deployment
 * until the Postgres repository (ADR-004) and the Stalwart sender land.
 */
const config = loadConfig();
const { app } = createAuthApp(config, new InMemoryStore(), new LogMailSender());

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`[auth-api] listening on http://localhost:${info.port}`);
    console.log(`[auth-api] health: http://localhost:${info.port}/health`);
  },
);
