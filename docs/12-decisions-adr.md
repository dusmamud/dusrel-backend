# Decisions — ADR Log

Status: DRAFT — 2026-10-31
Har bada decision yahan date + reason + rejected option ke saath
likha jayega. Bina ADR ke bada decision code me nahi jayega.

## ADR-001 — Monorepo, ek backend folder

- Decision: Backend aur future services ek hi folder/structure me
  rahenge, shared packages ke saath.
- Reason: Drive/Chat/Meet me auth, crypto, DB dobara nahi banana hai.
- Rejected: Har app ka alag repo — sharing khatam ho jati, aur
  version drift hota.
- Status: Docs ke liye istemal ho raha hai, final lock pending.

## ADR-002 — Language TypeScript only (v1)

- Decision: Frontend + backend dono TypeScript, strict.
- Reason: Ek language, ek team, shared Zod schemas, ecosystem.
- Rejected: Backend ke liye Go/Rust v1 me — performance ka fayda
  v1 ke scale par complexity se kam hai. Baad me performance-critical
  service alag language me ho sakti hai, tab alag ADR banega.

## ADR-003 — Backend Hono, frontend Next.js frontend-only

- Decision: Hono + Zod backend, Next.js frontend-only static export.
- Reason: Hono halka aur HTTP-portable hai; Next.js Pages par
  static deploy seedha hai, backend alag rahega.
- Rejected: NestJS (bada team structure, v1 me overhead), Next.js
  Server Actions me backend (logic do jagah bat jata).
- Correction (locked): Hono ki portability sirf HTTP API tak hai.
  Mail server Workers par nahi chal sakta — dekho README correction.

## ADR-004 — Database Cockroach vs Postgres — OPEN

- Decision: Abhi OPEN hai. Docs Cockroach ko default maan kar likhe
  gaye hain, lekin lock nahi hai.
- Cockroach ke paksh me: distributed scale, ek cluster me alag
  schema, Postgres-compatible (Drizzle pg driver).
- Postgres (managed/VPS) ke paksh me: sasta, simple, chhote launch
  ke liye kaafi, cost risk nahi.
- Cost risk: Cockroach Standard example ~$203/mo (2 vCPU + 100 GB)
  trial ke baad — isliye decision se pehle user ka budget jawab
  chahiye.
- Status: User se decision pending hai. Jab decision hoga to is ADR
  me date aur final choice update hogi.

## ADR-005 — Mail server Stalwart, Mailcow/Postfix nahi

- Decision: Stalwart core mail server.
- Reason: Ek server me JMAP/IMAP/SMTP, built-in DKIM/SPF/DMARC,
  spam filter, S3 backend, ACME, TOTP.
- Rejected: Mailcow (Maildir local, R2 native nahi), manual
  Postfix+Dovecot+Rspamd (zyada moving parts, R2 ke liye jugaad).
- Note: Stalwart infra hai, is repo ka app code nahi hai.

## ADR-006 — Storage R2, mail body Cockroach me nahi

- Decision: Blobs R2 me, metadata Cockroach me.
- Reason: Bade blobs object storage me saste aur tez hain, DB me
  slow aur mehenge hain.
- Rejected: Sab kuch DB me rakhna, sab kuch VPS disk par rakhna
  (VPS badalna mushkil ho jata).

## ADR-007 — E2EE standard, custom crypto nahi

- Decision: OpenPGP.js Curve25519 + libsodium jaisi standard
  libraries, BIP39 seed.
- Reason: Standard interoperable hai (Thunderbird/Proton/gpg),
  audit hua hai, custom crypto me galti ka risk zyada hai.
- Rejected: Apna encryption format banana — kabhi nahi.

## ADR-008 — Meet ke liye LiveKit, khud SFU nahi

- Decision: LiveKit SFU, VPS-only media.
- Reason: WebRTC SFU banana alag product hai, LiveKit ready hai,
  E2EE support karta hai, SDKs ready hain.
- Rejected: Jitsi (taiyaar UI hai, lekin Dusrel ka custom branded
  Meet banane ke liye control kam hai), khud SFU banana.

## ADR-013 — Web app pehla client hai, uska alag spec hoga

- Decision: Web app ko client docs me sirf ek row me nahi rakha
  jayega — uska poora spec `docs/20-web-app.md` me hoga, kyunki
  web hi pehla client hai aur Tauri desktop bhi isi frontend ko
  reuse karega.
- Reason: Client docs (15-19) me web ka poora spec missing tha —
  user ne ye kami pakdi, aur is ADR + doc se theek ki gayi hai.
- Status: Docs ke liye locked, code baad me frontend repo me banega.

## ADR-010 — Clients: native alag, docs central

- Decision: Android native (Kotlin), iOS Swift (SwiftUI) aur Desktop
  (Tauri) ke code repo alag honge, lekin unki planning docs isi
  backend repo me rahenge (`docs/15-19`, `clients/*` scope READMEs).
- Reason: Backend API, auth aur crypto ka sach ek jagah rahe, lekin
  native code ka build system (Gradle / Xcode / Tauri) backend repo
  ko bhari na banaye.
- Rejected: Sab code ek hi repo me dalna (build complexity badhti),
  aur client docs ko alag alag jagah rakhna (API drift hota).

## ADR-011 — Desktop Tauri v2, Electron fallback

- Decision: Desktop ka default Tauri v2 hai — chhota installer
  (aksar 3-15 MB vs Electron 50-150 MB), kam memory, scoped
  capabilities security ke liye.
- Rejected (default): Electron — mature hai, lekin bada bundle aur
  zyada security checklist ka bojh hai. Sirf tab jab Tauri WebView
  koi zaroori feature block kare, tab alag ADR ke saath Electron
  par jana hoga.

## ADR-012 — Client security: platform keystore hi sach hai

- Decision: Android Keystore (StrongBox jahan mile), iOS Keychain +
  Secure Enclave, Desktop OS Keychain — teeno par secret kabhi
  plain file / SharedPreferences / UserDefaults me nahi.
- Reason: OWASP Mobile guidance — client par bharosa mat karo,
  password device par store mat karo, sensitive data platform key
  se lock karke rakho.
- Rejected: Apna custom secure storage banana, ya seed/key ko
  plain local file me rakhna.

## ADR-009 — Public signup Phase 4 tak nahi

- Decision: Phase 1-3 me public signup nahi hoga.
- Reason: Bina abuse control, terms aur privacy ke public hote hi
  IP reputation aur legal risk dono badhenge.
- Status: Locked for Phase 1-3.
