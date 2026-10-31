import { randomUUID } from "node:crypto";

/**
 * App-level store for mail-api v1: aliases + key directory entries.
 * Mailbox data itself is NOT here — that is the JMAP client's job
 * (split-brain rule, docs/29). In-memory, lost on restart, like
 * auth-api v1. The Postgres version (after ADR-004) must implement
 * the same shapes; see packages/db for the future alias/key tables
 * (not yet defined there — aliases/keys are new in this slice, and
 * their Drizzle tables are a TODO for the Postgres wiring step).
 */

export interface Alias {
  address: string;
  createdAt: Date;
  disabledAt: Date | null;
  id: string;
  userId: string;
}

export interface PublicKeyEntry {
  address: string;
  createdAt: Date;
  fingerprint: string;
  publicKeyArmored: string;
  userId: string;
}

export class MailStore {
  aliases = new Map<string, Alias>();
  keys = new Map<string, PublicKeyEntry>();

  createAlias(userId: string, address: string): Alias {
    const row: Alias = {
      address,
      createdAt: new Date(),
      disabledAt: null,
      id: randomUUID(),
      userId,
    };
    this.aliases.set(row.id, row);
    return row;
  }

  listAliasesByUser(userId: string): Alias[] {
    return [...this.aliases.values()].filter(
      (a) => a.userId === userId && !a.disabledAt,
    );
  }

  findAliasByAddress(address: string): Alias | undefined {
    const lower = address.toLowerCase();
    for (const alias of this.aliases.values()) {
      if (alias.address === lower && !alias.disabledAt) {
        return alias;
      }
    }
    return undefined;
  }

  disableAlias(userId: string, id: string): Alias | undefined {
    const row = this.aliases.get(id);
    if (!row || row.userId !== userId || row.disabledAt) {
      return undefined;
    }
    row.disabledAt = new Date();
    return row;
  }

  publishKey(entry: Omit<PublicKeyEntry, "createdAt">): PublicKeyEntry {
    const row: PublicKeyEntry = { ...entry, createdAt: new Date() };
    // One key per address: republishing replaces the old entry.
    this.keys.set(entry.address.toLowerCase(), row);
    return row;
  }

  getKey(address: string): PublicKeyEntry | undefined {
    return this.keys.get(address.toLowerCase());
  }
}
