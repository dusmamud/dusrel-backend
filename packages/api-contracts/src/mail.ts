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

// Query-string booleans: z.coerce.boolean() "false" ko bhi true
// bana deta hai (Boolean("false") === true), isliye enum + transform
// hi sahi tareeqa hai. Galat value par 400 aayega, silent true nahi.
const queryBooleanSchema = z
  .enum(["true", "false"])
  .transform((v) => v === "true")
  .optional();

export const listMessagesQuerySchema = z.object({
  flaggedOnly: queryBooleanSchema,
  limit: z.coerce.number().int().min(1).max(100).default(50),
  mailbox: z.string().min(1).max(64).optional(),
  query: z.string().max(256).optional(),
  unreadOnly: queryBooleanSchema,
});
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

export const sendEmailSchema = z.object({
  bodyText: z.string().min(1).max(200_000),
  cc: z.array(emailSchema).max(50).optional().default([]),
  // Optional sender: primary address ya apna alias hi ho sakta hai.
  // Service me ownership check hota hai (403 warna). Na diya ho to
  // primary address use hota hai (purana behaviour, tests wahi hain).
  from: emailSchema.optional(),
  subject: z.string().max(998),
  to: z.array(emailSchema).min(1).max(50),
});
export type SendEmailInput = z.infer<typeof sendEmailSchema>;

/**
 * App-level user settings (docs/05): signature + display name.
 * Ye Stalwart/Sieve settings NAHI hain — Sieve rules ka app-level
 * hissa Phase 2 me Stalwart ke through aayega. Signature send par
 * auto-append NAHI hota (mail content chup-chap badalna galat
 * hota) — webmail compose me is signature ko dikhayega.
 * Empty string = cleared. Dono fields optional hain, PUT merge
 * karta hai (jo field nahi bheji, wo pehle wali hi rehti hai).
 */
export const updateSettingsSchema = z.object({
  displayName: z.string().trim().max(100).optional(),
  signature: z.string().max(5000).optional(),
});
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;

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
  // Fingerprint: v4 SHA-1 = 40 hex, v6 SHA-256 = 64 hex (RFC 4880 /
  // RFC 9580). Coordinator integration fix: crypto package openpgp
  // 6.x se v6 keys (64 hex) banata hai, isliye sirf 40 hex mangne
  // par uski keys 400 fail hoti thi. Dono lengths allowed hain;
  // koi aur length abhi bhi reject hoti hai (truncation nahi hai).
  fingerprint: z
    .string()
    .regex(
      /^([a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/,
      "Fingerprint must be 40 hex chars (v4) or 64 hex chars (v6)",
    ),
  publicKeyArmored: z
    .string()
    .startsWith("-----BEGIN PGP PUBLIC KEY BLOCK-----")
    .max(100_000),
});
export type PublishKeyInput = z.infer<typeof publishKeySchema>;
