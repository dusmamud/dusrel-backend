import type { JmapClient } from "../jmap.js";
import type { Alias, MailStore, PublicKeyEntry } from "../store.js";

/** Same shape as auth-api's ApiError; routes map it to JSON. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Reserved local-parts, duplicated from auth-api v1 (see note below).
 * Duplication debt, stated plainly: auth-api and mail-api are
 * separate services and must not import each other, so v1 copies
 * this list. The lists MUST stay identical until the shared address
 * package lands (planned with the Postgres wiring step). If they
 * drift, an address could be creatable as an alias but not as a
 * primary address, or vice versa.
 */
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

/** Alias limit per user — starting proposal from docs/29, not a lock. */
export const ALIAS_LIMIT_PER_USER = 10;

/** Quota per user — 5 GB (decimal), docs/29 starting proposal, not a lock. */
export const QUOTA_BYTES_PER_USER = 5_000_000_000;

function validateAliasAddress(address: string, primaryEmail: string): string {
  const lower = address.toLowerCase();
  const parts = lower.split("@");
  if (parts.length !== 2) {
    throw new ApiError(400, "invalid_email", "Alias must be a single address");
  }
  const [local, domain] = parts;
  const primaryDomain = primaryEmail.split("@")[1]?.toLowerCase();
  if (!primaryDomain || domain !== primaryDomain) {
    // Phase 1 is single-domain (docs/29 Section 6): an alias lives
    // on the user's own domain, never on someone else's domain.
    throw new ApiError(
      400,
      "invalid_domain",
      "Alias must be on your own domain",
    );
  }
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
  if (lower === primaryEmail.toLowerCase()) {
    throw new ApiError(400, "invalid_email", "Alias cannot equal your primary address");
  }
  return lower;
}

export class MailService {
  constructor(
    private jmap: JmapClient,
    private store: MailStore,
  ) {}

  listMailboxes(userId: string) {
    return this.jmap.listMailboxes(userId);
  }

  async listEmails(
    userId: string,
    options: {
      flaggedOnly?: boolean;
      limit: number;
      mailboxId?: string;
      mailboxName?: string;
      query?: string;
      unreadOnly?: boolean;
    },
  ) {
    let mailboxId = options.mailboxId;
    if (!mailboxId && options.mailboxName) {
      const boxes = await this.jmap.listMailboxes(userId);
      const box = boxes.find(
        (b) => b.name.toLowerCase() === options.mailboxName?.toLowerCase(),
      );
      if (!box) {
        throw new ApiError(404, "not_found", "Mailbox not found");
      }
      mailboxId = box.id;
    }
    return this.jmap.listEmails(userId, {
      flaggedOnly: options.flaggedOnly,
      limit: options.limit,
      mailboxId,
      query: options.query,
      unreadOnly: options.unreadOnly,
    });
  }

  /** Quota display (docs/05): usage JMAP se, limit starting proposal se. */
  async getQuota(userId: string) {
    const [boxes, usage] = await Promise.all([
      this.jmap.listMailboxes(userId),
      this.jmap.getUsage(userId),
    ]);
    return {
      aliasCount: this.store.listAliasesByUser(userId).length,
      aliasLimit: ALIAS_LIMIT_PER_USER,
      mailboxCount: boxes.length,
      messageCount: usage.messageCount,
      quotaBytes: QUOTA_BYTES_PER_USER,
      usedBytes: usage.usedBytes,
    };
  }

  getSettings(userId: string) {
    return this.store.getSettings(userId);
  }

  updateSettings(
    userId: string,
    patch: { displayName?: string; signature?: string },
  ) {
    return this.store.updateSettings(userId, patch);
  }

  async getEmail(userId: string, emailId: string) {
    const email = await this.jmap.getEmail(userId, emailId);
    if (!email) {
      // 404 for other users' mail too: never confirm existence.
      throw new ApiError(404, "not_found", "Message not found");
    }
    return email;
  }

  async sendEmail(
    userId: string,
    primaryEmail: string,
    input: {
      bodyText: string;
      cc: string[];
      from?: string;
      subject: string;
      to: string[];
    },
  ) {
    // Alias-send permission check (docs/05): from sirf primary
    // address ya apna alias ho sakta hai. Kisi aur ka address
    // (dusre user ka primary ya alias) 403 hai — warna koi bhi
    // kisi ke naam se mail bhej sakta. Na diya ho to primary.
    const effectiveFrom = (input.from ?? primaryEmail).toLowerCase();
    const owned =
      effectiveFrom === primaryEmail.toLowerCase() ||
      this.store.listAliasesByUser(userId).some((a) => a.address === effectiveFrom);
    if (!owned) {
      throw new ApiError(
        403,
        "forbidden",
        "You can only send from your own address or alias",
      );
    }
    return this.jmap.sendEmail(userId, { ...input, from: effectiveFrom });
  }

  async patchEmail(
    userId: string,
    emailId: string,
    patch: { isFlagged?: boolean; isRead?: boolean; mailboxId?: string },
  ) {
    if (patch.mailboxId) {
      const moved = await this.jmap.moveEmail(userId, emailId, patch.mailboxId);
      if (!moved) {
        throw new ApiError(404, "not_found", "Message or mailbox not found");
      }
      if (patch.isFlagged !== undefined || patch.isRead !== undefined) {
        const patched = await this.jmap.patchEmail(userId, emailId, {
          isFlagged: patch.isFlagged,
          isRead: patch.isRead,
        });
        return patched ?? moved;
      }
      return moved;
    }
    const patched = await this.jmap.patchEmail(userId, emailId, {
      isFlagged: patch.isFlagged,
      isRead: patch.isRead,
    });
    if (!patched) {
      throw new ApiError(404, "not_found", "Message not found");
    }
    return patched;
  }

  /** DELETE moves to Trash; deleting from Trash purges (docs/21 F10). */
  async deleteEmail(userId: string, emailId: string): Promise<{ purged: boolean }> {
    const email = await this.jmap.getEmail(userId, emailId);
    if (!email) {
      throw new ApiError(404, "not_found", "Message not found");
    }
    const boxes = await this.jmap.listMailboxes(userId);
    const trash = boxes.find((b) => b.role === "trash");
    if (!trash) {
      throw new ApiError(500, "internal_error", "Trash mailbox missing");
    }
    if (email.mailboxId === trash.id) {
      const purged = await this.jmap.purgeEmail(userId, emailId);
      return { purged };
    }
    await this.jmap.moveEmail(userId, emailId, trash.id);
    return { purged: false };
  }

  createAlias(userId: string, primaryEmail: string, address: string): Alias {
    const lower = validateAliasAddress(address, primaryEmail);
    // v1 scope limit, stated plainly: uniqueness is checked only
    // against other aliases in this store, not against primary
    // addresses (mail-api cannot see auth-api's users yet). The
    // shared-DB wiring step must make this check global, or two
    // users could end up with colliding addresses.
    if (this.store.findAliasByAddress(lower)) {
      throw new ApiError(409, "alias_taken", "This alias is already in use");
    }
    if (this.store.listAliasesByUser(userId).length >= ALIAS_LIMIT_PER_USER) {
      throw new ApiError(409, "alias_limit", "Alias limit reached");
    }
    return this.store.createAlias(userId, lower);
  }

  listAliases(userId: string): Alias[] {
    return this.store.listAliasesByUser(userId);
  }

  deleteAlias(userId: string, id: string): void {
    const row = this.store.disableAlias(userId, id);
    if (!row) {
      throw new ApiError(404, "not_found", "Alias not found");
    }
  }

  publishKey(
    userId: string,
    primaryEmail: string,
    input: { address: string; fingerprint: string; publicKeyArmored: string },
  ): PublicKeyEntry {
    const lower = input.address.toLowerCase();
    const owned =
      lower === primaryEmail.toLowerCase() ||
      this.store.listAliasesByUser(userId).some((a) => a.address === lower);
    if (!owned) {
      throw new ApiError(
        403,
        "forbidden",
        "You can only publish a key for your own address or alias",
      );
    }
    // v1 limit, stated plainly: the fingerprint is stored as a
    // string only. Real PGP fingerprint verification (parse the key,
    // derive the fingerprint, compare) is Phase 3 work, not here.
    return this.store.publishKey({ ...input, address: lower, userId });
  }

  getKey(address: string): PublicKeyEntry {
    // Anti-probing (docs/05), by design: ye lookup sirf key store
    // me hota hai, user-existence check nahi hota. Isliye unknown
    // address aur no-key address dono ko BYTE-IDENTICAL 404 milta
    // hai — koi farq nahi batata ki address exist karta hai ya
    // nahi. Ye v1 me pehle se hi tha; is slice me sirf test se
    // prove kiya gaya hai (contract badla nahi gaya hai).
    const entry = this.store.getKey(address);
    if (!entry) {
      throw new ApiError(404, "not_found", "No public key for this address");
    }
    return entry;
  }
}
