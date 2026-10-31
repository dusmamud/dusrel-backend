import {
  createAliasSchema,
  listMessagesQuerySchema,
  patchMessageSchema,
  publishKeySchema,
  sendEmailSchema,
} from "@dusrel/api-contracts";
import { Hono } from "hono";
import { z } from "zod";
import type { MailConfig } from "../config.js";
import { getMailAuth, mailAuthMiddleware } from "../middleware/auth.js";
import { ApiError, MailService } from "../services/mailService.js";

function parseBody<S extends z.ZodTypeAny>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError(400, "validation_error", result.error.issues[0]?.message ?? "Invalid input");
  }
  return result.data;
}

function parseQuery(c: { req: { query: () => Record<string, string> } }) {
  const result = listMessagesQuerySchema.safeParse(c.req.query());
  if (!result.success) {
    throw new ApiError(400, "validation_error", result.error.issues[0]?.message ?? "Invalid query");
  }
  return result.data;
}

function serializeEmail(e: {
  bodyText: string | null;
  cc: string[];
  from: string;
  id: string;
  isFlagged: boolean;
  isRead: boolean;
  mailboxId: string;
  receivedAt: Date;
  snippet: string;
  subject: string;
  to: string[];
}) {
  return { ...e, receivedAt: e.receivedAt.toISOString() };
}

export function createMailRoutes(config: MailConfig, service: MailService): Hono {
  const app = new Hono();
  const auth = mailAuthMiddleware(config);
  app.use(auth);

  app.get("/mail/mailboxes", async (c) => {
    const { sub } = getMailAuth(c).claims;
    return c.json({ mailboxes: await service.listMailboxes(sub) });
  });

  app.get("/mail/messages", async (c) => {
    const { sub } = getMailAuth(c).claims;
    const query = parseQuery(c);
    const emails = await service.listEmails(sub, {
      limit: query.limit,
      mailboxName: query.mailbox,
      query: query.query,
    });
    return c.json({ messages: emails.map(serializeEmail) });
  });

  app.get("/mail/messages/:id", async (c) => {
    const { sub } = getMailAuth(c).claims;
    const email = await service.getEmail(sub, c.req.param("id") ?? "");
    return c.json({ message: serializeEmail(email) });
  });

  app.post("/mail/send", async (c) => {
    const { email, sub } = getMailAuth(c).claims;
    const body = parseBody(sendEmailSchema, await c.req.json().catch(() => null));
    const sent = await service.sendEmail(sub, email, body);
    return c.json({ message: serializeEmail(sent) }, 201);
  });

  app.patch("/mail/messages/:id", async (c) => {
    const { sub } = getMailAuth(c).claims;
    const body = parseBody(patchMessageSchema, await c.req.json().catch(() => null));
    const email = await service.patchEmail(sub, c.req.param("id") ?? "", body);
    return c.json({ message: serializeEmail(email) });
  });

  app.delete("/mail/messages/:id", async (c) => {
    const { sub } = getMailAuth(c).claims;
    const result = await service.deleteEmail(sub, c.req.param("id") ?? "");
    return c.json(result);
  });

  app.get("/mail/aliases", async (c) => {
    const { sub } = getMailAuth(c).claims;
    const aliases = service.listAliases(sub).map((a) => ({
      address: a.address,
      createdAt: a.createdAt.toISOString(),
      id: a.id,
    }));
    return c.json({ aliases });
  });

  app.post("/mail/aliases", async (c) => {
    const { email, sub } = getMailAuth(c).claims;
    const body = parseBody(createAliasSchema, await c.req.json().catch(() => null));
    const alias = service.createAlias(sub, email, body.address);
    return c.json(
      { alias: { address: alias.address, createdAt: alias.createdAt.toISOString(), id: alias.id } },
      201,
    );
  });

  app.delete("/mail/aliases/:id", async (c) => {
    const { sub } = getMailAuth(c).claims;
    service.deleteAlias(sub, c.req.param("id") ?? "");
    return c.json({ ok: true });
  });

  app.post("/mail/keys", async (c) => {
    const { email, sub } = getMailAuth(c).claims;
    const body = parseBody(publishKeySchema, await c.req.json().catch(() => null));
    const entry = service.publishKey(sub, email, body);
    return c.json(
      {
        key: {
          address: entry.address,
          createdAt: entry.createdAt.toISOString(),
          fingerprint: entry.fingerprint,
        },
      },
      201,
    );
  });

  app.get("/mail/keys/:address", async (c) => {
    const address = decodeURIComponent(c.req.param("address") ?? "");
    const entry = service.getKey(address);
    return c.json({
      key: {
        address: entry.address,
        createdAt: entry.createdAt.toISOString(),
        fingerprint: entry.fingerprint,
        publicKeyArmored: entry.publicKeyArmored,
      },
    });
  });

  return app;
}
