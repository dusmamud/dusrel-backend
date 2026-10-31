# packages/db — Drizzle schemas + migrations (scope doc only, no code yet)

Karega: Cockroach ke liye Drizzle schemas, per-service schema
(auth, mail, drive, chat, meet), migrations ka ek jagah se
management.

Nahi karega: mail body store karna, private key plaintext me
store karna, kisi service ki table ko dusri service se seedha
todna-marodna.

Schema ka detail `docs/06-database-design.md` me hai. Final schema
code likhne se pehle lock hoga.

## Code (v1) — schema definition only

`src/schema.ts` me Drizzle (Postgres) tables hain: users,
secondary_emails, sessions, app_passwords, password_reset_tokens,
invites, backup_codes, user_totp, audit_log. UUID primary keys
mandatory hain (SERIAL Cockroach par Raft hotspot banata hai).

**Dhyaan rakho:** Running auth-api v1 me in-memory store use karta
hai, is schema ko nahi — kyunki ADR-004 (Cockroach vs cheaper
Postgres) abhi bhi OPEN hai aur Stalwart-on-Cockroach test pending
hai. Jab wo decision aayega, tab Postgres repository isi store
interface ko implement karega. TOTP secret ka encryption-at-rest
us waqt tak TODO hai — database me TOTP secret plaintext kabhi
nahi jayega.
