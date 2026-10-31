import { z } from "zod";

/**
 * Zod schemas for mail-api (v1 slice). Same rule as auth schemas:
 * bina schema ke koi endpoint nahi banega.
 *
 * Limits are starting values, not locks: body text 200,000 chars,
 * alias limit enforced in the service (10 per user, docs/29 proposal),
 * message list page size max 100.
 */

const emailSchema = z.string().trim().min(1).max(255).email();
const uuidSchema = z.string().uuid();

export const listMessagesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  mailbox: z.string().min(1).max(64).optional(),
  query: z.string().max(256).optional(),
});
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

export const sendEmailSchema = z.object({
  bodyText: z.string().min(1).max(200_000),
  cc: z.array(emailSchema).max(50).optional().default([]),
  subject: z.string().max(998),
  to: z.array(emailSchema).min(1).max(50),
});
export type SendEmailInput = z.infer<typeof sendEmailSchema>;

export const patchMessageSchema = z
  .object({
    isFlagged: z.boolean().optional(),
    isRead: z.boolean().optional(),
    mailboxId: uuidSchema.optional(),
  })
  .refine(
    (v) =>
      v.isFlagged !== undefined || v.isRead !== undefined || v.mailboxId !== undefined,
    { message: "At least one field must change" },
  );
export type PatchMessageInput = z.infer<typeof patchMessageSchema>;

export const createAliasSchema = z.object({
  address: emailSchema,
});
export type CreateAliasInput = z.infer<typeof createAliasSchema>;

export const publishKeySchema = z.object({
  address: emailSchema,
  fingerprint: z.string().regex(/^[a-fA-F0-9]{40}$/, "Fingerprint must be 40 hex chars"),
  publicKeyArmored: z
    .string()
    .startsWith("-----BEGIN PGP PUBLIC KEY BLOCK-----")
    .max(100_000),
});
export type PublishKeyInput = z.infer<typeof publishKeySchema>;
