import { randomUUID } from "node:crypto";

/**
 * Store interfaces + in-memory implementation for auth-api v1.
 *
 * This is the deliberate v1 runtime store. It is NOT Postgres:
 * ADR-004 (Cockroach vs cheaper Postgres) is still OPEN and the
 * Stalwart-on-Cockroach test is pending, so no Postgres repository
 * is wired yet. When ADR-004 lands, a PostgresStore must implement
 * this same interface (see packages/db schema) and replace
 * InMemoryStore in src/index.ts — routes and services must not
 * change. Data in this store is lost on restart. Never use it as a
 * production store.
 */

export type Role = "admin" | "owner" | "user";
export type UserStatus =
  | "active"
  | "banned"
  | "deleted"
  | "disabled"
  | "invite_pending"
  | "suspended";

export interface User {
  createdAt: Date;
  displayName: string;
  email: string;
  id: string;
  passwordHash: string | null;
  quotaGb: number;
  role: Role;
  status: UserStatus;
  suspendedUntil: Date | null;
  updatedAt: Date;
}

export interface Session {
  createdAt: Date;
  expiresAt: Date;
  id: string;
  ip: string | null;
  refreshTokenHash: string;
  revokedAt: Date | null;
  userAgent: string | null;
  userId: string;
}

export interface AppPassword {
  createdAt: Date;
  id: string;
  lastUsedAt: Date | null;
  name: string;
  passwordHash: string;
  revokedAt: Date | null;
  userId: string;
}

export interface ResetToken {
  createdAt: Date;
  expiresAt: Date;
  id: string;
  tokenHash: string;
  usedAt: Date | null;
  userId: string;
}

export interface Invite {
  createdAt: Date;
  createdBy: string | null;
  email: string;
  expiresAt: Date;
  id: string;
  role: Role;
  tokenHash: string;
  usedAt: Date | null;
}

export interface BackupCode {
  codeHash: string;
  createdAt: Date;
  id: string;
  usedAt: Date | null;
  userId: string;
}

export interface TotpRecord {
  createdAt: Date;
  secret: string;
  userId: string;
  verifiedAt: Date | null;
}

export interface SecondaryEmail {
  createdAt: Date;
  email: string;
  id: string;
  userId: string;
  verifiedAt: Date | null;
}

export interface SecondaryEmailOtp {
  attempts: number;
  codeHash: string;
  createdAt: Date;
  email: string;
  expiresAt: Date;
  userId: string;
}

export interface AuditEntry {
  action: string;
  actorUserId: string | null;
  createdAt: Date;
  id: string;
  reason: string | null;
  targetUserId: string | null;
}

export class InMemoryStore {
  auditLog: AuditEntry[] = [];
  appPasswords = new Map<string, AppPassword>();
  backupCodes = new Map<string, BackupCode>();
  invites = new Map<string, Invite>();
  resetTokens = new Map<string, ResetToken>();
  secondaryEmails = new Map<string, SecondaryEmail>();
  secondaryEmailOtps = new Map<string, SecondaryEmailOtp>();
  sessions = new Map<string, Session>();
  totpRecords = new Map<string, TotpRecord>();
  users = new Map<string, User>();

  createUser(input: Omit<User, "createdAt" | "id" | "updatedAt">): User {
    const now = new Date();
    const user: User = { ...input, createdAt: now, id: randomUUID(), updatedAt: now };
    this.users.set(user.id, user);
    return user;
  }

  getUserByEmail(email: string): User | undefined {
    const lower = email.toLowerCase();
    for (const user of this.users.values()) {
      if (user.email === lower) {
        return user;
      }
    }
    return undefined;
  }

  getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  updateUser(id: string, patch: Partial<User>): User | undefined {
    const user = this.users.get(id);
    if (!user) {
      return undefined;
    }
    const updated: User = { ...user, ...patch, updatedAt: new Date() };
    this.users.set(id, updated);
    return updated;
  }

  createSession(input: Omit<Session, "createdAt" | "id">): Session {
    const session: Session = { ...input, createdAt: new Date(), id: randomUUID() };
    this.sessions.set(session.id, session);
    return session;
  }

  getSessionByRefreshHash(hash: string): Session | undefined {
    for (const session of this.sessions.values()) {
      if (session.refreshTokenHash === hash) {
        return session;
      }
    }
    return undefined;
  }

  listSessionsByUser(userId: string): Session[] {
    return [...this.sessions.values()].filter((s) => s.userId === userId);
  }

  revokeSession(id: string): void {
    const session = this.sessions.get(id);
    if (session && !session.revokedAt) {
      session.revokedAt = new Date();
    }
  }

  revokeAllSessionsForUser(userId: string): void {
    for (const session of this.sessions.values()) {
      if (session.userId === userId && !session.revokedAt) {
        session.revokedAt = new Date();
      }
    }
  }

  createResetToken(input: Omit<ResetToken, "createdAt" | "id">): ResetToken {
    const token: ResetToken = { ...input, createdAt: new Date(), id: randomUUID() };
    this.resetTokens.set(token.id, token);
    return token;
  }

  getResetTokenByHash(hash: string): ResetToken | undefined {
    for (const token of this.resetTokens.values()) {
      if (token.tokenHash === hash) {
        return token;
      }
    }
    return undefined;
  }

  invalidateResetTokensForUser(userId: string): void {
    for (const token of this.resetTokens.values()) {
      if (token.userId === userId && !token.usedAt) {
        token.usedAt = new Date();
      }
    }
  }

  createInvite(input: Omit<Invite, "createdAt" | "id">): Invite {
    const invite: Invite = { ...input, createdAt: new Date(), id: randomUUID() };
    this.invites.set(invite.id, invite);
    return invite;
  }

  getInviteByHash(hash: string): Invite | undefined {
    for (const invite of this.invites.values()) {
      if (invite.tokenHash === hash) {
        return invite;
      }
    }
    return undefined;
  }

  createAppPassword(input: Omit<AppPassword, "createdAt" | "id">): AppPassword {
    const row: AppPassword = { ...input, createdAt: new Date(), id: randomUUID() };
    this.appPasswords.set(row.id, row);
    return row;
  }

  listAppPasswordsByUser(userId: string): AppPassword[] {
    return [...this.appPasswords.values()].filter((p) => p.userId === userId);
  }

  revokeAppPassword(id: string): void {
    const row = this.appPasswords.get(id);
    if (row && !row.revokedAt) {
      row.revokedAt = new Date();
    }
  }

  revokeAllAppPasswordsForUser(userId: string): void {
    for (const row of this.appPasswords.values()) {
      if (row.userId === userId && !row.revokedAt) {
        row.revokedAt = new Date();
      }
    }
  }

  addBackupCodes(userId: string, hashes: string[]): BackupCode[] {
    const rows: BackupCode[] = hashes.map((codeHash) => ({
      codeHash,
      createdAt: new Date(),
      id: randomUUID(),
      usedAt: null,
      userId,
    }));
    for (const row of rows) {
      this.backupCodes.set(row.id, row);
    }
    return rows;
  }

  listUnusedBackupCodes(userId: string): BackupCode[] {
    return [...this.backupCodes.values()].filter(
      (c) => c.userId === userId && !c.usedAt,
    );
  }

  revokeAllBackupCodesForUser(userId: string): void {
    for (const code of this.backupCodes.values()) {
      if (code.userId === userId && !code.usedAt) {
        code.usedAt = new Date();
      }
    }
  }

  setTotp(record: TotpRecord): void {
    this.totpRecords.set(record.userId, record);
  }

  getTotp(userId: string): TotpRecord | undefined {
    return this.totpRecords.get(userId);
  }

  clearTotp(userId: string): void {
    this.totpRecords.delete(userId);
  }

  getVerifiedSecondaryEmail(userId: string): SecondaryEmail | undefined {
    for (const row of this.secondaryEmails.values()) {
      if (row.userId === userId && row.verifiedAt) {
        return row;
      }
    }
    return undefined;
  }

  upsertVerifiedSecondaryEmail(userId: string, email: string): SecondaryEmail {
    for (const row of this.secondaryEmails.values()) {
      if (row.userId === userId && row.email === email) {
        row.verifiedAt = new Date();
        return row;
      }
    }
    const row: SecondaryEmail = {
      createdAt: new Date(),
      email,
      id: randomUUID(),
      userId,
      verifiedAt: new Date(),
    };
    this.secondaryEmails.set(row.id, row);
    return row;
  }

  setSecondaryEmailOtp(otp: SecondaryEmailOtp): void {
    this.secondaryEmailOtps.set(`${otp.userId}:${otp.email}`, otp);
  }

  getSecondaryEmailOtp(userId: string, email: string): SecondaryEmailOtp | undefined {
    return this.secondaryEmailOtps.get(`${userId}:${email}`);
  }

  clearSecondaryEmailOtp(userId: string, email: string): void {
    this.secondaryEmailOtps.delete(`${userId}:${email}`);
  }

  addAudit(entry: Omit<AuditEntry, "createdAt" | "id">): AuditEntry {
    const row: AuditEntry = { ...entry, createdAt: new Date(), id: randomUUID() };
    this.auditLog.push(row);
    return row;
  }
}
