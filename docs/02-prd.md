# PRD — Product Requirements Document

Status: DRAFT — 2026-10-31
Product: Dusrel Backend, pehla product Mail; future Drive / Chat / Meet
Version: PRD v0.1 (docs phase)

## 1. Goals

1. Apne domain par secure mail chalana, apne VPS aur apni storage par.
2. Aisa backend foundation banana jisme future apps (Drive, Chat,
   Meet) bina auth/crypto/DB dobara banaye add ho jayein.
3. Atomic-style privacy: server user ka plaintext E2EE mail na padh sake.
4. VPS badalna aasan rakhna: state bahar (Cockroach + R2), compute VPS
   par.

## 2. Non-goals — ye Phase 1 me nahi banega

- Mobile app (Android/iOS) — webmail PWA kaafi hai Phase 1 me.
- Calendar / Contacts ka poora suite — Stalwart me CalDAV/CardDAV
  hai, lekin uska UI Phase 1 ka goal nahi hai.
- AI features (smart reply, summary, search on encrypted mail) —
  encrypted mail par server-side AI chal hi nahi sakta, isliye ye
  Phase 1 me bilkul nahi.
- Public signup aur billing — Phase 4 tak nahi.
- Apna WebRTC SFU banana — Meet ke liye LiveKit use hoga.
- Apna crypto protocol banana — OpenPGP / libsodium standard use hoga.

## 3. User stories — Mail Phase 1

### Must-have (P0)

- U1: User apne Dusrel account se login karke inbox dekh sake.
- U2: User mail bhej sake — Dusrel user ko aur bahar ke provider ko.
- U3: User reply / reply-all / forward kar sake.
- U4: User alias bana sake aur alias se bhej / le sake, asli address
  chhupe.
- U5: User folder bana sake, mail move / archive / trash kar sake.
- U6: User attachment bhej aur download kar sake (size limit docs me
  baad me lock hogi, abhi decide nahi).
- U7: User apna password + TOTP 2FA set kar sake; mail apps ke liye
  app password bana sake.
- U8: User Dusrel-to-Dusrel mail ko E2EE mode me bhej sake (webmail
  se), aur wapas decrypt karke padh sake.
- U9: User seed phrase se apna account dusre browser/device par
  restore kar sake.
- U10: User bahar ke user ko password-protected mail bhej sake, link
  expiry ke saath.

### Should-have (P1)

- S1: Search (plaintext mail par server search; E2EE mail par sirf
  client-side / metadata search — limit saaf batani hai).
- S2: Sieve filters / rules (spam, folder move).
- S3: Spam folder, block sender, report spam.
- S4: Quota dikhana — kitni storage use hui, kitni baki hai.
- S5: Multiple alias + catch-all OFF by default (spam se bachne ke
  liye).

### Nice-to-have (P2, baad me)

- N1: Scheduled send, undo send (ciphertext me hi store hoga, warna
  E2EE toot jayega — design me ye dhyan rakhna hai).
- N2: Templates, signatures.
- N3: Import from Gmail / other provider.

## 4. Future products — sirf scope, detail baad me

### Drive (future PRD alag se banega)

- Files upload/download, folders, sharing link (password + expiry),
  version history (baad me), E2EE files (client encrypt, R2 me
  ciphertext).
- Is PRD me Drive ka sirf itna lock hai: storage R2, metadata
  Cockroach, API `services/drive-api/`, aur auth wahi SSO.

### Chat (future)

- 1:1 aur group chat, WebSocket, media share (R2), E2EE baad me
  standard protocol se — custom chat crypto nahi.
- Service: `services/chat-api/`, persistent connection, VPS/Render.

### Meet (future)

- Video meeting, screen share, chat in-meeting, recording (baad me).
- Media: LiveKit SFU, VPS-only. Token/room API: `services/meet-api/`.
- Khud ka SFU kabhi nahi banega.

## 5. User types aur permissions

| Role | Kya kar sakta hai |
|---|---|
| Owner / Admin | User banana, quota set karna, domain/DNS dekhna, abuse action lena |
| User | Apna inbox, alias, key, settings manage karna |
| Guest (password link) | Sirf us link wala mail padhna, expiry tak, aur kuch nahi |

Public signup Phase 1 me nahi hai, isliye "public user" role abhi nahi
hai.

## 6. Privacy aur legal requirements (PRD level)

- Privacy policy aur terms Phase 4 (public) se pehle zaroori hain;
  Phase 1 (private/team) me bhi basic policy likhni hai.
- E2EE ka matlab aur limits user ko signup ke time saaf dikhane hain:
  seed bhoolne par recovery nahi, subject/headers encrypt nahi hote.
- Logs me mail body, password, seed, private key kabhi nahi aayegi.
- Abuse: spam bhejne wale account par rate limit aur block ka rule
  Phase 4 se pehle likhna hai, warna public hote hi IP reputation
  kharab ho jayegi.

## 7. Acceptance criteria — PRD level

- Har P0 story ka test `13-testing-qa.md` me pass hona chahiye.
- Koi P0 adhura ho to release nahi hogi, chahe P1/P2 poore ho jayein.
- E2EE ka dawa tabhi marketing/product page par likha jayega jab
  PGP round-trip aur seed recovery test pass ho.
