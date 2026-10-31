import { serve } from "@hono/node-server";
import { createMailApp } from "./app.js";
import { loadMailConfig } from "./config.js";

/**
 * Production-shaped entry, v1 reality: in-memory JMAP + in-memory
 * alias/key stores. See CODE-README.md limits — this is NOT a
 * production mail API until Stalwart JMAP + shared Postgres land.
 */
const config = loadMailConfig();
const { app } = createMailApp(config);

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  (info) => {
    console.log(`[mail-api] listening on http://localhost:${info.port}`);
    console.log(`[mail-api] health: http://localhost:${info.port}/health`);
  },
);
