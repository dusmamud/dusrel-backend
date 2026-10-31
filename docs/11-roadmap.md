# Roadmap — Phase wise plan

Status: DRAFT — 2026-10-31
Note: Is roadmap me koi date ya time estimate nahi hai. Date tabhi
likhi jayegi jab user khud date lock karega. Phase ka order hi lock
hai, calendar nahi.

## Phase 0 — Docs (chal raha hai, ye folder)

- [x] Backend folder structure banana (docs only, no code)
- [x] PRD, TRD, architecture, API, DB, security, deployment docs
- [ ] User se docs review karwana, correction lagana
- [ ] Stack lock ya Cockroach vs Postgres decision
- [ ] VPS par port 25 test dobara confirm karna (agar pehla test
  local PC par hua tha to)

Phase 0 complete tabhi mana jayega jab user docs ko "theek hai, aage
badho" bolega. Usse pehle code nahi likha jayega.

## Phase 1 — Mail core (pehla product)

- Stalwart install + DNS (MX/SPF/DKIM/DMARC/PTR) + mail-tester
- auth-api: login, TOTP, app passwords
- mail-api: alias, key directory ka basic hissa
- Webmail (frontend, is folder ke bahar): inbox, compose, reply,
  folders, trash, attachment
- Backup + monitoring ka basic setup
- Acceptance: `13-testing-qa.md` ke P0 test pass

## Phase 2 — Mail polish

- Sieve filters, spam tuning, quota display, search polish
- Multiple alias, settings, signature
- Deliverability warmup aur blacklist monitoring routine
- Operations runbook ka pehla real use (backup restore test)

## Phase 3 — E2EE poora

- Seed phrase signup/restore UI (frontend) + crypto package
- OpenPGP internal mail round-trip
- Password-protected external mail
- E2EE limits ka UI disclosure (subject/headers, seed loss)
- Acceptance: seed recovery test + PGP round-trip test pass

## Phase 4 — Public (sirf jab sab ready ho)

- Public signup (abuse control, captcha, rate limit ke saath)
- Terms, privacy policy, support page
- Billing — sirf tab jab paid plan decide ho, warna free hi rahega
  (decision abhi open hai, PRD me koi paid wada nahi hai)
- Is phase se pehle public signup ka koi announcement nahi hoga.

## Future — Drive, Chat, Meet (alag PRD har ek ke liye)

Order abhi lock nahi hai, lekin har ek ke liye pehle uska alag PRD
aur security doc banega, phir code:

- Drive: R2 files, sharing, E2EE files
- Chat: WebSocket, rooms, media
- Meet: LiveKit, rooms, recording (baad me)

Koi future product Phase 1 ke P0 ko slow nahi karega. Agar Drive ka
kaam Mail ke P0 se takrayega to Mail pehle poora hoga.

## Phase 5 — Clients: Web pehle, phir Android, iOS, Desktop

Web app Phase 1 ka pehla client hai, isliye uska spec
(`docs/20-web-app.md`) bhi docs me hai — client docs me web ka
sirf ek line me zikr rehna kami thi, is doc se theek ki gayi hai.

Docs abhi se ban gaye hain (`docs/15` se `docs/20` tak), code baad me:

Docs abhi se ban gaye hain (`docs/15` se `docs/19` tak), code baad me:

- Android native pehle (Kotlin + Compose, offline-first, Keystore)
- iOS Swift uske baad (Swift + SwiftUI, SwiftData, Keychain +
  Secure Enclave), jab API stable ho jaye
- Desktop Tauri uske baad / parallel (Windows pehle, phir macOS,
  phir Linux), web frontend reuse ke saath

Client code is backend repo me nahi aayega — har platform ka alag
repo banega. Client shuru karne se pehle us platform ka alag PRD
aur security review hoga, sirf ye docs kaafi nahi honge.
