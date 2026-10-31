# packages/db — Drizzle schemas + migrations (scope doc only, no code yet)

Karega: Cockroach ke liye Drizzle schemas, per-service schema
(auth, mail, drive, chat, meet), migrations ka ek jagah se
management.

Nahi karega: mail body store karna, private key plaintext me
store karna, kisi service ki table ko dusri service se seedha
todna-marodna.

Schema ka detail `docs/06-database-design.md` me hai. Final schema
code likhne se pehle lock hoga.
