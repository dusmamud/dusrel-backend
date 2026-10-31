import {
  generateAppPassword,
  generateBackupCodes,
  generateOtpCode,
  generateSecureToken,
  generateTotpSecret,
  hashPassword,
  hashToken,
  signAccessToken,
  totpAuthUri,
  verifyPassword,
  verifyTotp,
} from "@dusrel/auth";
import type { AuthConfig } from "../config.js";
import type { MailSender } from "../mailer.js";
import type { InMemoryStore, Role, User } from "../store.js";

/** Thrown by services, mapped to JSON by routes. Never leaks internals. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const INVALID_CREDENTIALS = "Invalid email or password";
const FORGOT_MESSAGE =
  "If an account exists for this email, a reset link has been sent to its verified secondary email.";

/** Reserved local-parts (docs/27 + 28). Never assigned, admin or signup. */
export const RESERVED_LOCAL_PARTS = new Set([
  "abuse",
  "account",
  "admin",
  "help",
  "hostmaster",
  "info",
  "mail",
  "no-reply",
  "noreply",
  "postmaster",
  "security",
  "support",
  "webmaster",
]);

export interface PublicUser {
  createdAt: string;
  displayName: string;
  email: string;
  id: string;
  quotaGb: number;
  role: Role;
  status: string;
  totpEnabled: boolean;
}

export function publicUser(user: User, totpEnabled: boolean): PublicUser {
  return {
    createdAt: user.createdAt.toISOString(),
    displayName: user.displayName,
    email: user.email,
    id: user.id,
    quotaGb: user.quotaGb,
    role: user.role,
    status: user.status,
    totpEnabled,
  };
}

function isTotpEnabled(store: InMemoryStore, userId: string): boolean {
  const record = store.getTotp(userId);
  return record !== undefined && record.verifiedAt !== null;
}

function requireActive(user: User): void {
  if (user.status !== "active") {
    // 403, not 401 (docs/28): signing in again cannot fix a state.
    throw new ApiError(403, "account_not_active", `Account is ${user.status}`);
  }
}

function validateNewAddress(email: string): string {
  const lower = email.toLowerCase();
  const parts = lower.split("@");
  if (parts.length !== 2) {
    throw new ApiError(400, "invalid_email", "Email must be a single address");
  }
  const [local] = parts;
  if (local.length < 3 || local.length > 64) {
    throw new ApiError(400, "invalid_email", "Local part must be 3-64 characters");
  }
  if (!/^[a-z0-9._-]+$/.test(local)) {
    throw new ApiError(
      400,
      "invalid_email",
      "Local part may contain only a-z, 0-9, dot, underscore, hyphen",
    );
  }
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    throw new ApiError(
      400,
      "invalid_email",
      "Local part must not start/end with a dot or contain consecutive dots",
    );
  }
  if (RESERVED_LOCAL_PARTS.has(local)) {
    throw new ApiError(400, "reserved_email", "This address is reserved");
  }
  return lower;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function issueTokens(
  store: InMemoryStore,
  config: AuthConfig,
  user: User,
  ip: string | null,
  userAgent: string | null,
): TokenPair {
  const refreshToken = generateSecureToken();
  const session = store.createSession({
    expiresAt: new Date(Date.now() + config.refreshTokenTtlSeconds * 1000),
    ip,
    refreshTokenHash: hashToken(refreshToken),
    revokedAt: null,
    userAgent,
    userId: user.id,
  });
  // email claim: mail-api (and future services) need the user's
  // primary address for ownership checks (alias domain, key publish)
  // without calling auth-api. Added in the mail-api slice, 2026-10-31.
  const accessToken = signAccessToken(
    config.jwtSecret,
    { email: user.email, role: user.role, sid: session.id, sub: user.id },
    config.accessTokenTtlSeconds,
  );
  return { accessToken, refreshToken };
}

export class AuthService {
  constructor(
    private store: InMemoryStore,
    private mailer: MailSender,
    private config: AuthConfig,
  ) {}

  async login(input: {
    backupCode?: string;
    email: string;
    ip: string | null;
    password: string;
    totpCode?: string;
    userAgent: string | null;
  }): Promise<{ tokens: TokenPair; user: PublicUser }> {
    const user = this.store.getUserByEmail(input.email);
    if (
      !user ||
      !user.passwordHash ||
      !(await verifyPassword(user.passwordHash, input.password))
    ) {
      // Generic message: no enumeration (docs/21 F3, docs/27).
      throw new ApiError(401, "invalid_credentials", INVALID_CREDENTIALS);
    }
    requireActive(user);
    const totp = this.store.getTotp(user.id);
    if (totp && totp.verifiedAt) {
      if (input.totpCode) {
        if (!verifyTotp(totp.secret, input.totpCode)) {
          throw new ApiError(401, "invalid_credentials", INVALID_CREDENTIALS);
        }
      } else if (input.backupCode) {
        const unused = this.store.listUnusedBackupCodes(user.id);
        let matched = false;
        for (const code of unused) {
          if (await verifyPassword(code.codeHash, input.backupCode)) {
            code.usedAt = new Date();
            matched = true;
            break;
          }
        }
        if (!matched) {
          throw new ApiError(401, "invalid_credentials", INVALID_CREDENTIALS);
        }
      } else {
        throw new ApiError(401, "totp_required", "Two-factor code required");
      }
    }
    const tokens = issueTokens(this.store, this.config, user, input.ip, input.userAgent);
    this.store.addAudit({
      action: "login",
      actorUserId: user.id,
      reason: null,
      targetUserId: user.id,
    });
    return { tokens, user: publicUser(user, isTotpEnabled(this.store, user.id)) };
  }

  async refresh(input: {
    ip: string | null;
    refreshToken: string;
    userAgent: string | null;
  }): Promise<TokenPair> {
    const session = this.store.getSessionByRefreshHash(hashToken(input.refreshToken));
    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      throw new ApiError(401, "invalid_refresh_token", "Refresh token is invalid");
    }
    const user = this.store.getUserById(session.userId);
    if (!user) {
      throw new ApiError(401, "invalid_refresh_token", "Refresh token is invalid");
    }
    requireActive(user);
    // Rotation: the old refresh token dies, a new pair is issued.
    this.store.revokeSession(session.id);
    return issueTokens(this.store, this.config, user, input.ip, input.userAgent);
  }

  logout(sessionId: string): void {
    this.store.revokeSession(sessionId);
  }

  listSessions(userId: string) {
    return this.store.listSessionsByUser(userId).map((s) => ({
      createdAt: s.createdAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      id: s.id,
      ip: s.ip,
      revokedAt: s.revokedAt?.toISOString() ?? null,
      userAgent: s.userAgent,
    }));
  }

  revokeSession(userId: string, sessionId: string): void {
    const session = this.store.sessions.get(sessionId);
    if (!session || session.userId !== userId) {
      throw new ApiError(404, "not_found", "Session not found");
    }
    this.store.revokeSession(sessionId);
  }

  revokeAllSessions(userId: string): void {
    this.store.revokeAllSessionsForUser(userId);
  }

  async changePassword(input: {
    currentPassword: string;
    invalidateAllSessions: boolean;
    newPassword: string;
    userId: string;
  }): Promise<void> {
    const user = this.store.getUserById(input.userId);
    if (!user || !user.passwordHash) {
      throw new ApiError(404, "not_found", "User not found");
    }
    if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
      throw new ApiError(401, "invalid_credentials", "Current password is incorrect");
    }
    const hash = await hashPassword(input.newPassword);
    this.store.updateUser(user.id, { passwordHash: hash });
    // All outstanding reset links die on password change (docs/21 F4).
    this.store.invalidateResetTokensForUser(user.id);
    if (input.invalidateAllSessions) {
      // Code choice (NOT a docs lock — docs/13 vs docs/21/25 still
      // contradict each other): "revoke all" also revokes app
      // passwords. A plain password change leaves app passwords alive.
      this.store.revokeAllSessionsForUser(user.id);
      this.store.revokeAllAppPasswordsForUser(user.id);
    }
    this.store.addAudit({
      action: "password_changed",
      actorUserId: user.id,
      reason: null,
      targetUserId: user.id,
    });
  }

  /**
   * Forgot password (docs/27 Section 3). Response is ALWAYS the same
   * message, whether or not the account exists, and the link goes ONLY
   * to the verified secondary email — never to the locked-out Dusrel
   * mailbox itself. If no verified secondary email exists, no mail is
   * sent and only the admin-reset / signed-in-reset paths remain; the
   * caller is told nothing different, so nothing is enumerated.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = this.store.getUserByEmail(email);
    if (user && user.status === "active") {
      const secondary = this.store.getVerifiedSecondaryEmail(user.id);
      if (secondary) {
        const token = generateSecureToken();
        this.store.createResetToken({
          expiresAt: new Date(Date.now() + this.config.resetTokenTtlSeconds * 1000),
          tokenHash: hashToken(token),
          usedAt: null,
          userId: user.id,
        });
        await this.mailer.send({
          subject: "Dusrel password reset",
          text:
            `You requested a password reset. Use this link within 1 hour:\n` +
            `${this.config.appUrl}/reset-password?token=${token}\n` +
            `If you did not request this, ignore this email. This link does not log you in by itself.`,
          to: secondary.email,
        });
      }
    }
    return { message: FORGOT_MESSAGE };
  }

  async resetPassword(input: { newPassword: string; token: string }): Promise<void> {
    const record = this.store.getResetTokenByHash(hashToken(input.token));
    if (!record || record.usedAt || record.expiresAt <= new Date()) {
      throw new ApiError(400, "invalid_token", "Reset link is invalid or expired");
    }
    const user = this.store.getUserById(record.userId);
    if (!user) {
      throw new ApiError(400, "invalid_token", "Reset link is invalid or expired");
    }
    const hash = await hashPassword(input.newPassword);
    this.store.updateUser(user.id, { passwordHash: hash });
    record.usedAt = new Date();
    // Single-use + all other reset links die + all sessions die.
    // No auto-login after reset (docs/27): the user must log in again.
    this.store.invalidateResetTokensForUser(user.id);
    this.store.revokeAllSessionsForUser(user.id);
    const secondary = this.store.getVerifiedSecondaryEmail(user.id);
    if (secondary) {
      await this.mailer.send({
        subject: "Dusrel password was reset",
        text:
          "Your Dusrel password was just reset. If this was not you, " +
          "contact support immediately. This email never contains a password.",
        to: secondary.email,
      });
    }
    this.store.addAudit({
      action: "password_reset",
      actorUserId: null,
      reason: null,
      targetUserId: user.id,
    });
  }

  async requestSecondaryEmailOtp(userId: string, email: string): Promise<void> {
    const lower = email.toLowerCase();
    const code = generateOtpCode();
    this.store.setSecondaryEmailOtp({
      attempts: 0,
      codeHash: hashToken(code),
      createdAt: new Date(),
      email: lower,
      expiresAt: new Date(Date.now() + this.config.otpTtlSeconds * 1000),
      userId,
    });
    await this.mailer.send({
      subject: "Dusrel secondary email verification code",
      text:
        `Your Dusrel verification code is ${code}. It expires in 10 minutes.\n` +
        `If you did not request this, ignore this email and contact support.`,
      to: lower,
    });
  }

  verifySecondaryEmailOtp(userId: string, email: string, code: string): void {
    const lower = email.toLowerCase();
    const record = this.store.getSecondaryEmailOtp(userId, lower);
    if (!record || record.expiresAt <= new Date()) {
      throw new ApiError(400, "invalid_code", "Code is invalid or expired");
    }
    if (record.attempts >= this.config.otpMaxAttempts) {
      // A new code does NOT reset the failed-attempt count for the
      // old one — the record is invalidated, a fresh request is needed.
      this.store.clearSecondaryEmailOtp(userId, lower);
      throw new ApiError(429, "too_many_attempts", "Too many failed attempts");
    }
    if (hashToken(code) !== record.codeHash) {
      record.attempts += 1;
      throw new ApiError(400, "invalid_code", "Code is invalid or expired");
    }
    this.store.clearSecondaryEmailOtp(userId, lower);
    this.store.upsertVerifiedSecondaryEmail(userId, lower);
  }

  listSecondaryEmails(userId: string) {
    return [...this.store.secondaryEmails.values()]
      .filter((r) => r.userId === userId)
      .map((r) => ({
        email: r.email,
        id: r.id,
        verifiedAt: r.verifiedAt?.toISOString() ?? null,
      }));
  }

  totpSetup(userId: string): { otpauthUrl: string; secret: string } {
    const existing = this.store.getTotp(userId);
    if (existing && existing.verifiedAt) {
      throw new ApiError(409, "totp_already_enabled", "Two-factor is already enabled");
    }
    const user = this.store.getUserById(userId);
    if (!user) {
      throw new ApiError(404, "not_found", "User not found");
    }
    const secret = generateTotpSecret();
    this.store.setTotp({
      createdAt: new Date(),
      secret,
      userId,
      verifiedAt: null,
    });
    return { otpauthUrl: totpAuthUri(secret, user.email), secret };
  }

  async totpVerify(userId: string, code: string): Promise<{ backupCodes: string[] }> {
    const record = this.store.getTotp(userId);
    if (!record) {
      throw new ApiError(400, "totp_not_setup", "Two-factor setup has not started");
    }
    if (record.verifiedAt) {
      throw new ApiError(409, "totp_already_enabled", "Two-factor is already enabled");
    }
    if (!verifyTotp(record.secret, code)) {
      throw new ApiError(401, "invalid_code", "Code is incorrect");
    }
    record.verifiedAt = new Date();
    // Old backup codes (if any) die on re-enrolment.
    this.store.revokeAllBackupCodesForUser(userId);
    const backupCodes = generateBackupCodes();
    const hashes = await Promise.all(backupCodes.map((c) => hashPassword(c)));
    this.store.addBackupCodes(userId, hashes);
    return { backupCodes };
  }

  async totpDisable(input: {
    backupCode?: string;
    password: string;
    totpCode?: string;
    userId: string;
  }): Promise<void> {
    const user = this.store.getUserById(input.userId);
    if (!user || !user.passwordHash) {
      throw new ApiError(404, "not_found", "User not found");
    }
    // MFA changes require re-auth with an existing factor (docs/21 F5):
    // current password AND the current TOTP/backup code.
    if (!(await verifyPassword(user.passwordHash, input.password))) {
      throw new ApiError(401, "invalid_credentials", "Password is incorrect");
    }
    const record = this.store.getTotp(user.id);
    if (!record || !record.verifiedAt) {
      throw new ApiError(400, "totp_not_enabled", "Two-factor is not enabled");
    }
    let factorOk = false;
    if (input.totpCode && verifyTotp(record.secret, input.totpCode)) {
      factorOk = true;
    } else if (input.backupCode) {
      for (const code of this.store.listUnusedBackupCodes(user.id)) {
        if (await verifyPassword(code.codeHash, input.backupCode)) {
          code.usedAt = new Date();
          factorOk = true;
          break;
        }
      }
    }
    if (!factorOk) {
      throw new ApiError(401, "invalid_code", "Two-factor code is incorrect");
    }
    this.store.clearTotp(user.id);
    this.store.revokeAllBackupCodesForUser(user.id);
    this.store.addAudit({
      action: "totp_disabled",
      actorUserId: user.id,
      reason: null,
      targetUserId: user.id,
    });
  }

  async createAppPassword(
    userId: string,
    name: string,
  ): Promise<{ createdAt: string; id: string; name: string; password: string }> {
    const password = generateAppPassword();
    const row = this.store.createAppPassword({
      lastUsedAt: null,
      name,
      passwordHash: await hashPassword(password),
      revokedAt: null,
      userId,
    });
    // The password is returned exactly once. It is never stored
    // in plaintext and never returned again by any endpoint.
    return {
      createdAt: row.createdAt.toISOString(),
      id: row.id,
      name: row.name,
      password,
    };
  }

  listAppPasswords(userId: string) {
    return this.store.listAppPasswordsByUser(userId).map((p) => ({
      createdAt: p.createdAt.toISOString(),
      id: p.id,
      lastUsedAt: p.lastUsedAt?.toISOString() ?? null,
      name: p.name,
      revokedAt: p.revokedAt?.toISOString() ?? null,
    }));
  }

  revokeAppPassword(userId: string, id: string): void {
    const row = this.store.appPasswords.get(id);
    if (!row || row.userId !== userId) {
      throw new ApiError(404, "not_found", "App password not found");
    }
    this.store.revokeAppPassword(id);
  }

  /** For future IMAP/JMAP client auth (mail-server step). Not an HTTP login. */
  async verifyAppPassword(userId: string, password: string): Promise<boolean> {
    for (const row of this.store.listAppPasswordsByUser(userId)) {
      if (!row.revokedAt && (await verifyPassword(row.passwordHash, password))) {
        row.lastUsedAt = new Date();
        return true;
      }
    }
    return false;
  }

  adminCreateUser(input: {
    actor: User;
    displayName: string;
    email: string;
    quotaGb?: number;
    role: "admin" | "user";
  }): { inviteId: string; user: PublicUser } {
    const email = validateNewAddress(input.email);
    if (this.store.getUserByEmail(email)) {
      throw new ApiError(409, "email_taken", "This address is already in use");
    }
    const user = this.store.createUser({
      displayName: input.displayName,
      email,
      passwordHash: null,
      quotaGb: input.quotaGb ?? 5,
      role: input.role,
      status: "invite_pending",
      suspendedUntil: null,
    });
    const token = generateSecureToken();
    const invite = this.store.createInvite({
      createdBy: input.actor.id,
      email,
      expiresAt: new Date(Date.now() + this.config.inviteTtlSeconds * 1000),
      role: input.role,
      tokenHash: hashToken(token),
      usedAt: null,
    });
    // Invite mail goes to the new address itself (first-login invite,
    // docs/21 F1) — this is the one mail that legitimately goes to a
    // Dusrel address, because the account has no secondary email yet.
    void this.mailer.send({
      subject: "Your Dusrel account invitation",
      text:
        `You have been invited to Dusrel. Set your password within 24 hours:\n` +
        `${this.config.appUrl}/accept-invite?token=${token}\n` +
        `If you were not expecting this, ignore this email.`,
      to: email,
    });
    this.store.addAudit({
      action: "user_created",
      actorUserId: input.actor.id,
      reason: null,
      targetUserId: user.id,
    });
    return { inviteId: invite.id, user: publicUser(user, false) };
  }

  async inviteAccept(token: string, password: string): Promise<PublicUser> {
    const invite = this.store.getInviteByHash(hashToken(token));
    if (!invite || invite.usedAt || invite.expiresAt <= new Date()) {
      throw new ApiError(400, "invalid_token", "Invite is invalid or expired");
    }
    const user = this.store.getUserByEmail(invite.email);
    if (!user || user.status !== "invite_pending") {
      throw new ApiError(400, "invalid_token", "Invite is invalid or expired");
    }
    invite.usedAt = new Date();
    const updated = this.store.updateUser(user.id, {
      passwordHash: await hashPassword(password),
      status: "active",
    });
    if (!updated) {
      throw new ApiError(400, "invalid_token", "Invite is invalid or expired");
    }
    this.store.addAudit({
      action: "invite_accepted",
      actorUserId: user.id,
      reason: null,
      targetUserId: user.id,
    });
    return publicUser(updated, false);
  }

  adminListUsers(): PublicUser[] {
    return [...this.store.users.values()].map((u) =>
      publicUser(u, isTotpEnabled(this.store, u.id)),
    );
  }

  adminSetUserState(input: {
    actor: User;
    reason: string;
    state: "active" | "banned" | "disabled" | "suspended";
    suspendedUntil: Date | null;
    targetId: string;
  }): PublicUser {
    const target = this.store.getUserById(input.targetId);
    if (!target) {
      throw new ApiError(404, "not_found", "User not found");
    }
    if (target.id === input.actor.id) {
      throw new ApiError(400, "cannot_change_self", "You cannot change your own state");
    }
    if (input.actor.role === "admin" && target.role !== "user") {
      throw new ApiError(403, "forbidden", "Admins cannot change owner/admin accounts");
    }
    if (input.state === "suspended" && target.status === "suspended") {
      // Re-suspension is allowed (extends the state); no special case.
    }
    const updated = this.store.updateUser(target.id, {
      status: input.state,
      suspendedUntil: input.state === "suspended" ? input.suspendedUntil : null,
    });
    if (!updated) {
      throw new ApiError(404, "not_found", "User not found");
    }
    if (input.state !== "active") {
      // A non-active user is kicked out immediately.
      this.store.revokeAllSessionsForUser(target.id);
    }
    this.store.addAudit({
      action: `user_${input.state}`,
      actorUserId: input.actor.id,
      reason: input.reason,
      targetUserId: target.id,
    });
    return publicUser(updated, isTotpEnabled(this.store, target.id));
  }

  adminDeleteUser(actor: User, targetId: string): void {
    const target = this.store.getUserById(targetId);
    if (!target) {
      throw new ApiError(404, "not_found", "User not found");
    }
    if (target.id === actor.id) {
      throw new ApiError(400, "cannot_change_self", "You cannot delete yourself");
    }
    if (actor.role === "admin" && target.role !== "user") {
      throw new ApiError(403, "forbidden", "Admins cannot delete owner/admin accounts");
    }
    this.store.updateUser(target.id, { status: "deleted" });
    this.store.revokeAllSessionsForUser(target.id);
    this.store.addAudit({
      action: "user_deleted",
      actorUserId: actor.id,
      reason: null,
      targetUserId: target.id,
    });
  }

  adminAuditLog() {
    return this.store.auditLog.map((e) => ({
      action: e.action,
      actorUserId: e.actorUserId,
      createdAt: e.createdAt.toISOString(),
      id: e.id,
      reason: e.reason,
      targetUserId: e.targetUserId,
    }));
  }
}
