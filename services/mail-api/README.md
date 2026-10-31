# mail-api — app-level mail API (scope doc only, no code yet)

Purpose: Webmail ke liye app-level kaam — jo Stalwart khud nahi
karta ya jo Dusrel ka apna logic hai.

Karega: alias create/list/delete, public key directory
(login-only lookup, public oracle nahi), password-protected link
create/fetch/revoke/expiry, quota display, user mail settings ka
app-level hissa.

Nahi karega: SMTP transport chalana, mailbox storage khud
sambhalna, mail body ko plaintext me log karna. Transport aur
storage Stalwart + R2 ka kaam hai.

Dependencies: `packages/auth` (JWT verify), `packages/crypto`
(key directory helpers), `packages/db` (mail schema),
`packages/api-contracts`, Stalwart (JMAP/IMAP ke through, jab
zaroorat ho).

Deploy: Render ya VPS Docker — stateless HTTP API hai.
Mail server is service me nahi hai, wo `../mail-server/` hai.
