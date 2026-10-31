# Dusrel Backend — Docs Only (No Code Yet)

> Status: DOCUMENTATION PHASE ONLY — 2026-10-31
> Is folder me abhi koi code nahi hai. Sirf PRD, TRD, architecture aur
> product docs hain. Code likhne se pehle user se alag se approval lena hai.
> Ye rule is repo ke har future step par lagu rahega: pehle batao, phir
> confirmation ke baad hi code/config likho.

## Ye kya hai

Dusrel Backend ek monorepo-style backend folder hai jisme aaj Mail ka
backend banega aur future me Drive, Chat, Meet aur baaki Dusrel apps ke
backend isi structure me add honge — bina dobara auth, crypto, database
ya API contract banaye.

Frontend is folder me nahi hai. Har web app (mail, drive, chat, meet)
alag Cloudflare Pages project par deploy hogi, aur is folder ke backend
services se REST API ke through baat karegi. Frontend ka repo/structure
alag se decide hoga; yahan sirf backend ka sach hai.

## Vision — ek line me

Proton / Google Workspace jaisa apna suite, lekin apne domain, apne VPS
aur apni storage par — jahan server kabhi user ka plaintext mail ya file
na padh sake (jahan E2EE lagu hota hai), aur har app ek hi login, ek hi
design system aur ek hi crypto layer share kare.

## Product map

| App | Status | Backend service (is folder me) | Notes |
|---|---|---|---|
| Mail | Phase 1 — pehla product | `services/mail-api/` + `services/mail-server/` | Stalwart mail server, VPS-only |
| Drive | Future | `services/drive-api/` | R2 files, sharing, E2EE files baad me |
| Chat | Future | `services/chat-api/` | WebSocket, persistent service |
| Meet | Future | `services/meet-api/` | LiveKit SFU, VPS-only media |
| Web app (pehla client) | Phase 1 — sabse pehle | `clients/web-app/` | Next.js frontend-only, static export, Pages + PWA — `docs/20-web-app.md` |
| Auth (shared) | Phase 1 — sab apps ke liye | `services/auth-api/` | Single SSO, ek login sab apps ke liye |
| Android native (future) | Docs only, code alag repo me hoga | `clients/android-native/` | Kotlin + Compose, Room, Keystore — `docs/16-android-native.md` |
| iOS Swift (future) | Docs only, code alag repo me hoga | `clients/ios-swift/` | Swift + SwiftUI, SwiftData, Keychain — `docs/17-ios-swift.md` |
| Desktop Tauri (future) | Docs only, code alag repo me hoga | `clients/desktop-tauri/` | Tauri v2, Windows pehle — `docs/18-desktop.md` |

## Stack — docs ke liye istemal hua stack (2026-10-31 ko discuss hua)

- Language: TypeScript, strict mode — frontend aur backend dono me ek hi language
- Monorepo tooling (poore suite ke liye): pnpm workspaces + Turborepo
  (is backend folder ke andar code aane par wahi tooling lagu hogi)
- Backend framework: Hono + Zod (Node, Docker me)
- ORM: Drizzle ORM
- Database: CockroachDB Cloud — SIRF app metadata ke liye, single region,
  mail body kabhi isme nahi. Cost risk ke liye `docs/03-trd.md` dekho.
- Object storage: Cloudflare R2 — mail blobs, attachments, Drive files
- Mail server: Stalwart (Rust, alag infra service, code is repo ka hissa
  nahi) — JMAP / IMAP / SMTP, VPS-only
- Meet media: LiveKit (Go SFU, alag infra service) — VPS-only
- Frontend (is folder ke bahar): Next.js App Router, frontend-only,
  static export, Cloudflare Pages via GitHub Actions

### CORRECTION — Hono + Workers wale dawe ka sahi scope

Pehle ek dawa bahut broad bol diya gaya tha: "Hono code Render/VPS se
Workers par bina rewrite ke chal jayega." Us roop me ye mail ke liye
GALAT hai, aur is repo me ye correction locked hai:

- Sahi hai: Hono wale HTTP API handlers (auth, alias list, key directory,
  drive metadata) Node / Render / VPS / Workers par chal sakte hain.
- Galat hai: Mail server Workers par nahi chal sakta. Workers par general
  inbound TCP listener nahi hai, outbound port 25 prohibited hai, aur
  dedicated IP / PTR nahi milta. Stalwart hamesha VPS par rahega.
- Cloudflare Email Routing / Email Sending full mail server nahi hai —
  Routing sirf forward karta hai, Sending sirf API se bhejta hai.

Is correction ke bina koi deployment doc mat likhna.

## Folder structure — rich, code aane se pehle

```
dusrel-backend/
  README.md                  # ye file
  docs/                      # saare product + technical docs
    00-docs-index.md
    01-product-overview.md
    02-prd.md
    03-trd.md
    04-architecture.md
    05-api-contracts.md
    06-database-design.md
    07-security-e2ee.md
    08-mail-deliverability.md
    09-deployment.md
    10-project-structure.md
    11-roadmap.md
    12-decisions-adr.md
    13-testing-qa.md
    14-operations-runbook.md
    15-client-overview.md
    16-android-native.md
    17-ios-swift.md
    18-desktop.md
    19-client-security-sync.md
    20-web-app.md
  clients/
    web-app/README.md          # pehla client, spec docs/20 me hai
    android-native/README.md   # docs only, code alag repo me hoga
    ios-swift/README.md        # docs only, code alag repo me hoga
    desktop-tauri/README.md    # docs only, code alag repo me hoga
  services/
    auth-api/README.md       # SSO service — scope doc, code nahi
    mail-api/README.md       # HTTP API, Stalwart se bridge
    mail-server/README.md    # Stalwart infra — VPS-only, config baad me
    drive-api/README.md      # Future
    chat-api/README.md       # Future
    meet-api/README.md       # Future, LiveKit token/room
  packages/
    auth/README.md           # shared auth helpers — scope doc
    crypto/README.md         # shared E2EE — scope doc
    db/README.md             # Drizzle schemas — scope doc
    api-contracts/README.md  # shared Zod schemas — scope doc
    config/README.md         # shared tsconfig/eslint — scope doc
    utils/README.md          # shared utils — scope doc
  infra/README.md            # Docker / Caddy / VPS / Render — scope doc
  .github/workflows/README.md # GitHub Actions plan — workflow files baad me
```

Har `services/*` aur `packages/*` folder me abhi sirf ek README hai jo
uska scope, input, output aur dependencies batata hai. Implementation
files (`.ts`, `package.json`, Dockerfile, workflow `.yml`) tabhi add
honge jab user us service ke liye alag se "code likho" bolega.

## Docs padhne ka order

1. `docs/00-docs-index.md` — har doc kis sawaal ka jawab deta hai
2. `docs/01-product-overview.md` — product kya hai, kiske liye hai
3. `docs/02-prd.md` — kya banega, kya nahi banega (scope lock)
4. `docs/03-trd.md` — technical stack, constraints, non-goals
5. `docs/04-architecture.md` — system diagram shabd me, data flow
6. Baaki docs — API, DB, security, deliverability, deployment, testing,
   operations — implementation se pehle padhna zaroori hai

## Sabse sakht rules (docs se code tak)

1. **Ask-first:** koi code, config, install ya push user ki explicit
   approval ke bina nahi.
2. **Server kabhi plaintext key nahi dekhega:** E2EE design me private
   key aur seed phrase server par kabhi plaintext me nahi jayenge.
3. **State VPS disk par nahi:** metadata Cockroach me, blobs R2 me.
   VPS sirf compute hai, isliye VPS badalna data migration nahi banega.
4. **Mail server VPS-only:** Stalwart aur LiveKit kabhi Workers/Render
   ke mail/media kaam par nahi jayenge.
5. **No secret in repo:** API keys, R2 secrets, DB connection string,
   DKIM private key kabhi Git me nahi. Sirf env / Secure Vault.
6. **Claim only what is verified:** koi feature "ho gaya" tabhi likhna
   jab uska test (mail-tester, PGP round-trip, seed recovery) pass ho.

## Open decisions — in par user ka jawab abhi baki hai

- Stack final lock hua ya nahi? Docs isi discussed stack par likhe gaye
  hain; lock hone par `docs/12-decisions-adr.md` me ADR-001 update hoga.
- Cockroach vs sasta Postgres variant — cost ke liye TRD me dono ka
  comparison hai, decision pending hai.
- Mail public signup kab hoga? Phase 4 tak nahi — abuse control, terms
  aur privacy policy ke baad hi.
- Domain/hostnames final: `mail.dusrel.com` docs me example ke taur par
  hai; final domain user confirm karega.
