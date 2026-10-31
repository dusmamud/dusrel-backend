# Architecture — system kaise judta hai

Status: DRAFT — 2026-10-31

## High-level flow (shabd me diagram)

```
User browser / PWA (Next.js, Cloudflare Pages)
        |  HTTPS, REST + JMAP
        v
  +-----+-------------------------------+
  |  Dusrel Backend (is folder)         |
  |                                     |
  |  auth-api  -> SSO, JWT, TOTP        |
  |  mail-api  -> alias, key directory, |
  |               password-link service |
  |  drive-api -> (future) R2 presigned |
  |  chat-api  -> (future) WebSocket    |
  |  meet-api  -> (future) LiveKit token|
  +-----+-------------------------------+
        |                 |
        v                 v
  CockroachDB Cloud   Cloudflare R2
  (metadata only)     (ciphertext blobs)
        |
        v
  Stalwart mail server (VPS-only, alag infra)
  SMTP in/out, IMAP, JMAP, DKIM/SPF/DMARC
        |
        v
  Internet mail (Gmail, Outlook, etc.)
```

LiveKit media server (future Meet) bhi VPS par alag infra ke taur par
chalega, meet-api se sirf token/room ka kaam hoga, media LiveKit se.

## Data flow — Mail ke 4 raste

### A. Normal mail bhejna (non-E2EE, bahar ke user ko)

1. Webmail -> mail-api (auth check) -> Stalwart SMTP submission
2. Stalwart DKIM sign karta hai, TLS se bahar ke server ko bhejta hai
3. Copy R2 blob store me jati hai (Stalwart blob backend ke through)

### B. Internal E2EE mail (Dusrel -> Dusrel, webmail se)

1. Browser me recipient ki public key Cockroach directory se milti hai
   (login-only lookup).
2. Browser me OpenPGP.js se body encrypt hoti hai, PGP/MIME banti hai.
3. Ciphertext Stalwart se jata hai, R2 me ciphertext store hota hai.
4. Recipient ka browser apni private key (IndexedDB, seed-locked) se
   decrypt karta hai. Server kabhi plaintext nahi dekhta.

### C. Mail lena (bahar se)

1. Bahar ka server MX -> mail.dusrel.com -> VPS Stalwart port 25
2. Stalwart SPF/DKIM/DMARC verify, spam filter, phir mailbox me
3. Webmail JMAP/IMAP se mail dikhata hai; E2EE mail ho to browser me
   decrypt hota hai, warna normal render hota hai.

### D. Password-protected mail (bahar ke user ko, E2EE jaisa)

1. Browser me password se derived key (Argon2id + AES-GCM) se body
   encrypt hoti hai.
2. Ciphertext R2 me, link + expiry + metadata Cockroach me.
3. Recipient link kholta hai, password dalta hai, browser me decrypt
   hota hai. Password server ko kabhi nahi bheja jata — sirf usse
   derived verification (ya link ke andar kaam) design me lock hoga,
   implementation se pehle security review zaroori hai.

## Service boundaries — kaun kya nahi karega

- `auth-api` mail nahi bhejega, files nahi sambhalega. Sirf identity.
- `mail-api` mail transport nahi chalayega — transport Stalwart ka
  kaam hai. mail-api sirf app-level kaam karega: alias, key directory,
  password-link, quota display.
- `drive-api` mail nahi dekhega. `chat-api` files ka storage nahi
  chalayega, R2 ka presigned URL drive-api ke pattern se lega.
- Koi service dusri service ka database table seedha nahi chhedegi.
  Cross-service kaam API ke through hoga, ya shared `packages/db`
  me defined schema ke through — dono me se ek rule code aane par
  lock hoga, abhi dono likhna mana hai.

## State map — kya kahan rahega

| Data | Kahan | Kyu |
|---|---|---|
| Users, aliases, folders, metadata | Cockroach, schema per service | Query + relations ke liye |
| Public keys | Cockroach, login-only lookup | Directory ke liye |
| Seed-encrypted private-key backup | Cockroach, ciphertext only | Restore ke liye, server decrypt nahi kar sakta |
| Mail bodies, attachments | R2, ciphertext (E2EE) ya Stalwart blob | Bade blobs ke liye object storage |
| Drive files | R2, per-user prefix | Bade files ke liye |
| Sessions | JWT + refresh (design lock baad me) | Stateless API ke liye |
| Mail queue | Stalwart (VPS) | SMTP queue ka kaam mail server ka hai |
| Config | Env / Secure Vault | Git me kabhi nahi |

## Failure modes — kya tootega to kya hoga

- Cockroach down: login aur metadata kaam nahi karega, lekin pehle se
  queued mail Stalwart par rukega, khoyega nahi (queue design).
- R2 down: naye mail ki body store nahi hogi, Stalwart temporary
  error dega aur sender retry karega. Isliye R2 write ka verify
  (Stalwart ka verifyAfterWrite jaisa behaviour) on rakhna hai.
- VPS down: mail server aur APIs down, lekin Cockroach + R2 ka data
  surakshit rahega. Dusre VPS par deploy karke wapas la sakte hain
  (dekho `09-deployment.md`).
- Seed kho gaya: us user ka E2EE mail hamesha ke liye gaya. Iska
  koi server-side workaround nahi hai — ye design hai, bug nahi.
