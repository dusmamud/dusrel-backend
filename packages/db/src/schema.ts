import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Drizzle (Postgres) schema definitions only.
 *
 * v1 note — read this before wiring a runtime repository: the running
 * auth-api in v1 uses an in-memory store, NOT this schema, because
 * the DB decision (ADR-004: Cockroach vs cheaper Postgres) is still
 * OPEN and the Stalwart-on-Cockroach compatibility test is pending
 * (docs/23 P0-10, docs/29 Section 7). When that decision lands, the
 * Postgres repository must implement the same store interface the
 * in-memory store implements today, and these tables are the target
 * shape. Do not run migrations against a production database from
 * this file until ADR-004 is decided.
 *
 * UUID primary keys are mandatory (docs/26): SERIAL creates Raft
 * write hotspots on Cockroach. Never store mail bodies, plaintext
 * private keys, plaintext seeds, plaintext passwords, or plaintext
 * tokens in these tables — only hashes (passwords, tokens, codes)
 * and, for TOTP, an encrypted secret (encryption-at-rest for the
 * TOTP secret is a TODO before Postgres wiring; see user_totp).
 */

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const users = pgTable("users", {
  displayName: varchar("display_name", { length: 128 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  id: uuid("id").defaultRandom().primaryKey(),
  passwordHash: text("password_hash"),
  quotaGb: integer("quota_gb").notNull().default(5),
  role: varchar("role", { length: 32 }).notNull().default("user"),
  status: varchar("status", { length: 32 }).notNull().default("invite_pending"),
  ...timestamps,
});

export const secondaryEmails = pgTable("secondary_emails", {
  email: varchar("email", { length: 255 }).notNull().unique(),
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  ...timestamps,
});

export const sessions = pgTable("sessions", {
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  ip: varchar("ip", { length: 64 }),
  refreshTokenHash: text("refresh_token_hash").notNull().unique(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  userAgent: text("user_agent"),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

export const appPasswords = pgTable("app_passwords", {
  id: uuid("id").defaultRandom().primaryKey(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  name: varchar("name", { length: 64 }).notNull(),
  passwordHash: text("password_hash").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

export const invites = pgTable("invites", {
  createdBy: uuid("created_by").references(() => users.id),
  email: varchar("email", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  role: varchar("role", { length: 32 }).notNull().default("user"),
  tokenHash: text("token_hash").notNull().unique(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  ...timestamps,
});

export const backupCodes = pgTable("backup_codes", {
  codeHash: text("code_hash").notNull(),
  id: uuid("id").defaultRandom().primaryKey(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  ...timestamps,
});

export const userTotp = pgTable("user_totp", {
  // TODO before Postgres wiring: encrypt this value at rest with a
  // key from the secret store. Never store a TOTP secret in plaintext
  // in the database. The v1 in-memory store keeps it only in process
  // memory, which is why this column is named *_encrypted.
  secretEncrypted: text("secret_encrypted").notNull(),
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  ...timestamps,
});

export const auditLog = pgTable("audit_log", {
  action: varchar("action", { length: 128 }).notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  id: uuid("id").defaultRandom().primaryKey(),
  reason: text("reason"),
  targetUserId: uuid("target_user_id").references(() => users.id),
  ...timestamps,
});

// Note: whether TOTP is enabled for a user is derived from
// user_totp.verified_at being non-null. There is no separate
// totp_enabled column on users, so the two can never disagree.
