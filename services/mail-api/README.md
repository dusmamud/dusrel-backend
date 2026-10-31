# mail-api — app-level mail API (code, v1 slice)

Purpose: Webmail ke liye app-level kaam — jo Stalwart khud nahi
karta ya jo Dusrel ka apna logic hai.

Karega (v1, implemented + tested):
- Mailboxes list (default: Inbox, Sent, Drafts, Archive, Spam, Trash)
- Messages list (mailbox filter + search), get, send (Sent me jata hai),
  patch (read/flag/move), delete (Trash me jata hai, Trash se delete
  purge karta hai)
- Aliases: create/list/delete — limit 10 per user (starting proposal),
  reserved names reject, sirf apne domain par, primary address alias
  nahi ban sakta
- Key directory (basic): apni address/alias ke liye public key publish,
  login-only lookup (public oracle nahi) — fingerprint abhi string
  ke taur par store hota hai, real PGP verification Phase 3 me aayega

Nahi karega: SMTP transport chalana, mailbox storage khud
sambhalna, mail body ko plaintext me log karna. Transport aur
storage Stalwart + R2 ka kaam hai. Password-protected link
(Phase 3/4) aur quota display is slice me nahi hain.

Dependencies: `packages/auth` (JWT verify), `packages/api-contracts`
(mail Zod schemas). `packages/crypto` abhi bhi docs-only hai (Phase 3),
`packages/db` ka mail schema abhi define nahi hua hai — alias/key
tables Postgres wiring step me define honge.

Deploy: Render ya VPS Docker — stateless HTTP API hai.
Mail server is service me nahi hai, wo `../mail-server/` hai.

## JMAP interface + fake (v1 ki sachchai)

- `src/jmap.ts` JMAP client interface hai. Split-brain rule ke
  hisaab se mailbox flags/counts Stalwart ke DataStore ka sach
  hain — mail-api unko apne DB me duplicate-track nahi karega.
- Sirf `InMemoryJmapClient` hai (fake). Asli Stalwart JMAP client
  tab banega jab Stalwart VPS par chalega — bina server ke JMAP
  client likhna jhootha claim hota.
- Fake me har email sirf ek mailbox me hota hai (real JMAP me ek
  email kayi mailbox me ho sakta hai) — ye simplification interface
  ke comment me likhi hai.

## Auth limit (v1, chhupaya nahi gaya)

mail-api JWT ki signature + expiry hi verify karta hai. Session
revoke / account suspend ka check isme nahi hai, kyunki auth-api
ke sessions uske in-memory store me hain jo mail-api dekh nahi
sakta. Revoked token ki window 15-minute access TTL tak limited
hai. Fix: shared Postgres (ADR-004 ke baad) ya auth-api par token
introspection endpoint — dono baad ke steps hain. Isliye mail-api
auth ko auth-api ke session-checked auth ke barabar mat samajhna.

## JWT email claim (is slice me badla gaya)

auth-api ke access token me ab `email` claim bhi hai (packages/auth
+ auth-api me change, auth tests dobara pass hue). mail-api isi se
alias domain aur key-publish ownership check karta hai.

## Known v1 debts (is slice ke)

1. Reserved-names list auth-api se copy ki gayi hai (services ek
   dusre ko import nahi kar sakte) — dono lists identical rehni
   chahiye jab tak shared address package na ban jaye.
2. Alias uniqueness sirf alias store ke andar check hoti hai,
   primary addresses ke against nahi — shared DB ke baad ye check
   global hoga.
3. Key fingerprint string-only hai — PGP parse + derive + compare
   Phase 3 me aayega.

## Run / test

```sh
npx -y pnpm@12.16.1 install
npx -y pnpm@12.16.1 -r build
cd services/mail-api
MAIL_JWT_SECRET=dev-only-change-me node dist/src/index.js
# health: curl http://localhost:3002/health
npx -y pnpm@12.16.1 --filter @dusrel/mail-api test
```
