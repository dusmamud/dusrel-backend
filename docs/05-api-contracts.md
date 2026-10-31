# API Contracts — har service ka API shape

Status: DRAFT — 2026-10-31
Note: Ye doc contract ka shape batata hai, implementation nahi.
Actual routes, versioning aur error codes code likhne se pehle lock
honge. Koi route yahan likha hai to wo final nahi hai, jab tak user
us service ke liye approve na kare.

## General rules — sab services par lagu

- Protocol: REST + JSON, HTTPS only.
- Versioning: URL me `/v1/` se shuru hoga. Breaking change bina
  version badhaye nahi hoga.
- Auth: har request par JWT (Authorization header). Public endpoints
  ki list alag se lock hogi — default sab protected hai.
- Validation: har request aur response par Zod schema, shared
  `packages/api-contracts` me. Bina schema ke endpoint nahi banega.
- Errors: ek hi shape — `{ error: { code, message } }`, HTTP status
  sahi hoga (400 validation, 401 unauthenticated, 403 forbidden,
  404 not found, 429 rate limit, 500 server error). Error message me
  kabhi secret, stack trace ya mail body nahi aayegi.
- Pagination: list endpoints par cursor ya page + limit, dono me se
  ek lock hoga code se pehle.
- Rate limiting: login, send, upload par alag limit hogi, TRD me
  numbers baad me lock honge.
- CORS: sirf allowlisted frontend origins. `*` kabhi nahi.
- Idempotency: send jaise critical actions par idempotency key ka
  rule code se pehle lock hoga, warna double-send ho sakta hai.

## auth-api — SSO (sab apps ke liye ek)

Scope:

- Signup/login (Phase 1 me private/team only — public signup nahi)
- JWT issue + refresh + revoke
- TOTP 2FA setup/verify, app passwords (IMAP clients ke liye)
- Password change, session list, session revoke
- OIDC provider ban-na Stalwart aur future apps ke liye (baad me
  lock hoga ki OIDC Phase 1 me hai ya Phase 2 me)

Kabhi nahi karega: mail bhejna, files store karna, seed phrase ya
private key ko plaintext me lena.

## mail-api — app-level mail API

Scope:

- Alias create/list/delete, alias se send ka permission check
- Public key directory: login user ke liye recipient key lookup
  (public oracle nahi — unknown address aur no-key ka jawab ek
  jaisa hona chahiye, taaki address probing na ho)
- Password-protected link: create (ciphertext R2 me, metadata
  Cockroach me), fetch metadata, expiry, revoke
- Quota / mailbox info display
- User settings: signature, filters ka app-level hissa (Sieve rules
  Stalwart ke through honge, design baad me lock hoga)

Kabhi nahi karega: SMTP transport chalana, mailbox storage khud
sambhalna. Transport aur storage Stalwart + R2 ka kaam hai.

Mail read/send ka asli protocol webmail ke liye JMAP/IMAP hoga
(Stalwart se), REST sirf app-level kaam ke liye hai. Dono ko mix
karke ek hi endpoint me mat dalna.

## drive-api — future, sirf scope

- Folder/file metadata, presigned upload/download URL (R2),
  sharing link create/revoke, password + expiry (baad me)
- File content kabhi API server ke through stream karne ka default
  nahi hoga — presigned R2 URL pattern pehle try hoga.

## chat-api — future, sirf scope

- WebSocket connection, rooms, messages, presence (baad me)
- Persistent service hogi — Workers par long-lived socket ka dawa
  nahi karna.

## meet-api — future, sirf scope

- Room create, LiveKit token issue (JWT, expiry kam), room list
- Media LiveKit se hoga, is API se video stream nahi jayega.

## mail-server — ye API service nahi hai

`services/mail-server/` ek HTTP API nahi hai, ye Stalwart infra hai.
Iska contract SMTP / IMAP / JMAP protocol hai, REST nahi. Is folder
me code nahi, Stalwart ka deployment aur DNS doc hoga (`08-...`).

## Frontend integration rule

- Frontend (Next.js, Pages) har backend se sirf is doc ke contracts
  se baat karega.
- Frontend me API URL env se aayega (`NEXT_PUBLIC_*`), hardcode nahi.
- E2EE encrypt/decrypt frontend (browser) me hoga, API par plaintext
  E2EE body kabhi nahi jayegi.
