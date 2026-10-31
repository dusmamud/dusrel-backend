import { randomUUID } from "node:crypto";
import type { Email, JmapClient, Mailbox, SendDraft } from "./jmap.js";

/**
 * In-memory JMAP implementation for v1 tests and local development.
 * Lost on restart, like the auth-api in-memory store. Never a
 * production mail store — production mail lives in Stalwart + R2.
 *
 * Default folders per user follow docs/21 F2: Inbox, Sent, Drafts,
 * Archive, Spam, Trash. A mailbox is created lazily on first access
 * for a user, so a brand-new user already has the standard set.
 */

interface StoredEmail extends Email {
  userId: string;
}

/**
 * Fake message size: subject + body + from + recipients ka UTF-8
 * byte length. Headers aur attachments fake me model nahi hote,
 * isliye ye ek estimate hai — real JMAP client server-reported
 * size use karega. Size ko kabhi mailbox counts ki tarah apne
 * store me duplicate-track mat karo (split-brain rule).
 */
function estimateSize(input: {
  bodyText: string | null;
  cc: string[];
  from: string;
  subject: string;
  to: string[];
}): number {
  return Buffer.byteLength(
    [input.subject, input.bodyText ?? "", input.from, ...input.to, ...input.cc].join("\n"),
    "utf8",
  );
}

/** API responses never carry the internal userId field. */
function stripUser(email: StoredEmail): Email {
  const { userId: _ignored, ...rest } = email;
  void _ignored;
  return rest;
}

const DEFAULT_FOLDERS: { name: string; role: Mailbox["role"] }[] = [
  { name: "Inbox", role: "inbox" },
  { name: "Sent", role: "sent" },
  { name: "Drafts", role: "drafts" },
  { name: "Archive", role: "archive" },
  { name: "Spam", role: "junk" },
  { name: "Trash", role: "trash" },
];

export class InMemoryJmapClient implements JmapClient {
  private emails = new Map<string, StoredEmail>();
  private mailboxes = new Map<string, Mailbox & { userId: string }>();

  private ensureMailboxes(userId: string): (Mailbox & { userId: string })[] {
    const existing = [...this.mailboxes.values()].filter((m) => m.userId === userId);
    if (existing.length > 0) {
      return existing;
    }
    const created = DEFAULT_FOLDERS.map((f) => ({
      id: randomUUID(),
      name: f.name,
      role: f.role,
      totalEmails: 0,
      unreadEmails: 0,
      userId,
    }));
    for (const m of created) {
      this.mailboxes.set(m.id, m);
    }
    return created;
  }

  mailboxByRole(userId: string, role: Mailbox["role"]): (Mailbox & { userId: string }) | undefined {
    return this.ensureMailboxes(userId).find((m) => m.role === role);
  }

  /** Test/dev helper only: simulate an inbound delivery into Inbox. */
  deliverEmail(
    userId: string,
    input: Omit<Email, "id" | "mailboxId" | "receivedAt" | "size"> & {
      receivedAt?: Date;
    },
  ): Email {
    const inbox = this.mailboxByRole(userId, "inbox");
    if (!inbox) {
      throw new Error("Inbox mailbox missing");
    }
    const email: StoredEmail = {
      ...input,
      id: randomUUID(),
      mailboxId: inbox.id,
      receivedAt: input.receivedAt ?? new Date(),
      size: estimateSize(input),
      userId,
    };
    this.emails.set(email.id, email);
    return email;
  }

  async getUsage(userId: string): Promise<{ messageCount: number; usedBytes: number }> {
    const mine = [...this.emails.values()].filter((e) => e.userId === userId);
    return {
      messageCount: mine.length,
      usedBytes: mine.reduce((sum, e) => sum + e.size, 0),
    };
  }

  async listMailboxes(userId: string): Promise<Mailbox[]> {
    const boxes = this.ensureMailboxes(userId);
    return boxes.map((box) => {
      const inBox = [...this.emails.values()].filter(
        (e) => e.userId === userId && e.mailboxId === box.id,
      );
      return {
        id: box.id,
        name: box.name,
        role: box.role,
        totalEmails: inBox.length,
        unreadEmails: inBox.filter((e) => !e.isRead).length,
      };
    });
  }

  async listEmails(
    userId: string,
    options: {
      flaggedOnly?: boolean;
      limit: number;
      mailboxId?: string;
      query?: string;
      unreadOnly?: boolean;
    },
  ): Promise<Email[]> {
    let list = [...this.emails.values()].filter((e) => e.userId === userId);
    if (options.mailboxId) {
      list = list.filter((e) => e.mailboxId === options.mailboxId);
    }
    if (options.query) {
      const q = options.query.toLowerCase();
      list = list.filter(
        (e) =>
          e.subject.toLowerCase().includes(q) ||
          e.from.toLowerCase().includes(q) ||
          e.snippet.toLowerCase().includes(q) ||
          (e.bodyText ?? "").toLowerCase().includes(q) ||
          e.to.some((t) => t.toLowerCase().includes(q)) ||
          e.cc.some((t) => t.toLowerCase().includes(q)),
      );
    }
    if (options.unreadOnly) {
      list = list.filter((e) => !e.isRead);
    }
    if (options.flaggedOnly) {
      list = list.filter((e) => e.isFlagged);
    }
    list.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
    return list.slice(0, options.limit).map(stripUser);
  }

  async getEmail(userId: string, emailId: string): Promise<Email | null> {
    const email = this.emails.get(emailId);
    if (!email || email.userId !== userId) {
      return null;
    }
    return stripUser(email);
  }

  async sendEmail(userId: string, draft: SendDraft): Promise<Email> {
    const sent = this.mailboxByRole(userId, "sent");
    if (!sent) {
      throw new Error("Sent mailbox missing");
    }
    const email: StoredEmail = {
      bodyText: draft.bodyText,
      cc: draft.cc,
      from: draft.from,
      id: randomUUID(),
      isFlagged: false,
      isRead: true,
      mailboxId: sent.id,
      receivedAt: new Date(),
      size: estimateSize(draft),
      snippet: draft.bodyText.slice(0, 200),
      subject: draft.subject,
      to: draft.to,
      userId,
    };
    this.emails.set(email.id, email);
    return stripUser(email);
  }

  async moveEmail(
    userId: string,
    emailId: string,
    mailboxId: string,
  ): Promise<Email | null> {
    const email = this.emails.get(emailId);
    const target = this.mailboxes.get(mailboxId);
    if (!email || email.userId !== userId || !target || target.userId !== userId) {
      return null;
    }
    email.mailboxId = mailboxId;
    return stripUser(email);
  }

  async patchEmail(
    userId: string,
    emailId: string,
    patch: { isFlagged?: boolean; isRead?: boolean },
  ): Promise<Email | null> {
    const email = this.emails.get(emailId);
    if (!email || email.userId !== userId) {
      return null;
    }
    if (patch.isFlagged !== undefined) {
      email.isFlagged = patch.isFlagged;
    }
    if (patch.isRead !== undefined) {
      email.isRead = patch.isRead;
    }
    return stripUser(email);
  }

  async purgeEmail(userId: string, emailId: string): Promise<boolean> {
    const email = this.emails.get(emailId);
    if (!email || email.userId !== userId) {
      return false;
    }
    this.emails.delete(emailId);
    return true;
  }
}
