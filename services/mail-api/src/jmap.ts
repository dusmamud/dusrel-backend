/**
 * JMAP client interface for mail-api.
 *
 * Design rule from docs/26 + docs/29 (split-brain rule): Stalwart's
 * internal DataStore is the source of truth for mailbox flags, UIDs
 * and counts. mail-api must NOT duplicate-track mailbox flags/counts
 * in its own database. It talks to the mail server through this
 * interface (JMAP in production, via Stalwart's native /jmap), and
 * keeps only app-level data itself (aliases, key directory entries).
 *
 * v1 reality: only InMemoryJmapClient exists (src/fakeJmap.ts).
 * The real Stalwart JMAP client is the next step once Stalwart runs
 * on the VPS — writing a client that pretends to speak JMAP without
 * a server to verify against would be a false claim.
 *
 * Simplification, stated plainly: the v1 fake models each email in
 * exactly ONE mailbox. Real JMAP allows an email in several mailboxes
 * at once. The interface uses a single mailboxId so the fake stays
 * honest about what it implements; the real client must map JMAP's
 * mailboxIds set onto this model (or the interface must grow).
 */

export interface Mailbox {
  id: string;
  name: string;
  role: "archive" | "drafts" | "inbox" | "junk" | "sent" | "trash" | null;
  totalEmails: number;
  unreadEmails: number;
}

export interface Email {
  bodyText: string | null;
  cc: string[];
  from: string;
  id: string;
  isFlagged: boolean;
  isRead: boolean;
  mailboxId: string;
  receivedAt: Date;
  /**
   * Message size in bytes. Real JMAP me ye server-reported size
   * hoga; fake me content ka UTF-8 byte length hai (headers /
   * attachments fake me model nahi hote, isliye fake ka size ek
   * estimate hai — quota endpoint is baat ko saaf likhta hai).
   */
  size: number;
  snippet: string;
  subject: string;
  to: string[];
}

export interface SendDraft {
  bodyText: string;
  cc: string[];
  from: string;
  subject: string;
  to: string[];
}

export interface JmapClient {
  getEmail(userId: string, emailId: string): Promise<Email | null>;
  /**
   * Quota usage — JMAP (source of truth) se, mail-api ke apne
   * store se nahi (split-brain rule). Real client ise JMAP
   * Email/query + server-reported sizes se banayega.
   */
  getUsage(userId: string): Promise<{ messageCount: number; usedBytes: number }>;
  listMailboxes(userId: string): Promise<Mailbox[]>;
  listEmails(
    userId: string,
    options: {
      flaggedOnly?: boolean;
      limit: number;
      mailboxId?: string;
      query?: string;
      unreadOnly?: boolean;
    },
  ): Promise<Email[]>;
  moveEmail(userId: string, emailId: string, mailboxId: string): Promise<Email | null>;
  patchEmail(
    userId: string,
    emailId: string,
    patch: { isFlagged?: boolean; isRead?: boolean },
  ): Promise<Email | null>;
  purgeEmail(userId: string, emailId: string): Promise<boolean>;
  sendEmail(userId: string, draft: SendDraft): Promise<Email>;
}
