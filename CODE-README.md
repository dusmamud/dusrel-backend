# Dusrel Backend — Code (v1 slice: scaffold + auth-api)

Ye file code chalane ka tareeka batati hai. Product docs `docs/` me
hain — ye file unko replace nahi karti.

## Kya bana hai (v1 slice)

- pnpm workspaces monorepo: `services/*` + `packages/*`, TypeScript
  strict, package naam `@dusrel/<name>` (`docs/10` ke hisaab se).
- `packages/utils` — pure utils (base32, random helpers).
- `packages/auth` — password hashing (Argon2id, OWASP parameters),
  TOTP (RFC 6238), JWT (HS256, Node crypto), token hashing,
  backup/app-password generation. Runtime dependency sirf `argon2`
  hai (is sandbox me uska prebuilt binary chal gaya hai, koi native
  build nahi karna pada).
- `packages/api-contracts` — auth endpoints ke Zod schemas.
- `packages/db` — Drizzle (Postgres) schema **sirf definition ke
  taur par**. Runtime Postgres repo abhi wired nahi hai, kyunki DB
  decision (ADR-004: Cockroach vs cheaper Postgres) abhi bhi OPEN hai
  aur Stalwart-on-Cockroach compatibility test pending hai.
- `services/auth-api` — Hono app, Node adapter se chalta hai.
  Endpoints: login, refresh, logout, sessions list/revoke, password
  change, forgot/reset password, TOTP setup/verify/disable, backup
  codes, app passwords, admin invite/accept, admin user list/state,
  admin audit log, health check. Detail `services/auth-api/README.md`
  me hai.
- `services/mail-api` — Hono app (Phase 1 basic slice, mail-api
  slice me bana). Endpoints: mailboxes, messages list/get/send/
  patch/delete (Trash + purge), aliases create/list/delete, key
  directory publish/get (basic). Mailbox data JMAP interface ke
  through aata hai — v1 me sirf in-memory fake hai, asli Stalwart
  JMAP client VPS step me banega. Detail
  `services/mail-api/README.md` me hai.

## Kaise chalaye

```sh
# pnpm: is sandbox ke Node build me corepack nahi hai, isliye yahan
# npx se pnpm chalaya gaya hai. Laptop par normal pnpm install /
# corepack enable wala rasta hi use karo.
npx -y pnpm@12.16.1 install
npx -y pnpm@12.16.1 -r build
cd services/auth-api
# Dev secret ke saath (production me AUTH_JWT_SECRET env se do,
# kabhi default secret par prod mat chalao):
AUTH_JWT_SECRET=dev-only-change-me node dist/src/index.js
```

Server `http://localhost:3001` par chalega (ya `PORT` env se).
Health check: `curl http://localhost:3001/health`.

Tests (Node test runner, compiled JS par chalte hain):

```sh
npx -y pnpm@12.16.1 --filter @dusrel/auth-api test
```

## Imaandaar limits (v1 slice ki, chhupayi nahi gayi hain)

1. **Data in-memory hai, persist nahi hota.** `services/auth-api`
   ka runtime store in-memory hai — server restart hua to users,
   sessions, tokens sab khatam ho jayenge. Ye jaanboojh kar hai:
   DB decision (ADR-004) lock hone aur Cockroach test pass hone ke
   baad hi Postgres repo wire hoga. Is slice ko production auth
   mat samajhna.
2. **Mail sender dev wala hai.** Forgot/reset/invite/notification
   mail abhi `LogMailSender` se jaate hain (console log) — asli
   Stalwart sender tab wire hoga jab mail server VPS par hoga.
   Tests me `CapturingMailSender` use hota hai taaki token capture
   karke flow verify ho sake. Production me token kabhi API response
   me nahi aayega.
3. **Public signup nahi hai.** Phase 1 me sirf admin (Owner/Admin)
   user banata hai, invite se (ADR-009, Phase 4 tak public signup
   nahi hai).
4. **App-password rule (code choice, docs lock nahi):** Normal
   password change par app passwords **bachte hain** — sirf jab user
   "revoke all sessions" chunta hai ya app password ko alag se revoke
   karta hai, tabhi wo khatam hote hain. Docs me ye rule abhi bhi
   contradiction me hai (`docs/13` vs `docs/21`/`docs/25`) — code ka
   ye choice docs ka lock nahi hai, docs update ke liye alag order
   chahiye hoga.
5. **Numbers starting values hain, locks nahi:** Access token 15
   minute, refresh token 30 din, reset token 1 ghanta, invite 24
   ghante, OTP 6 digits / 10 minute / 5 attempts, login rate limits
   — ye sab `src/config.ts` me hain aur code phase me lock hone
   chahiye.
6. **E2EE (Phase 3) is slice me nahi hai.** `packages/crypto`
   abhi bhi docs-only hai. Seed/PGP kaam Phase 3 me aayega.
7. **Turborepo binary abhi install nahi hua hai.** `turbo.json`
   is repo me nahi hai — root scripts `pnpm -r` se chalte hain.
   Turborepo wiring agle tooling step me hogi, jab laptop par
   native pnpm hoga.
8. **mail-api auth sirf signature + expiry check karta hai.**
   Session revoke / suspend ka check isme nahi hai (auth-api ke
   sessions mail-api dekh nahi sakta) — revoked token ki window
   15-minute access TTL tak hai. Fix shared Postgres ya token
   introspection se aayega, dono baad ke steps hain.
9. **mail-api ke v1 debts:** reserved-names list auth-api se copy
   hai (dono identical rehni chahiye); alias uniqueness sirf alias
   store ke andar check hoti hai, primary addresses ke against
   nahi; key fingerprint abhi string-only hai (real PGP verify
   Phase 3 me); fake me har email sirf ek mailbox me hota hai
   (real JMAP me kayi me ho sakta hai).
10. **mail-server infra slice (v1, 31 Oct 2026):**
    `services/mail-server/docker-compose.yml` (Stalwart 1.0.1 +
    Caddy + auth-api + mail-api), `Caddyfile`, `.env.example`,
    aur dono API Dockerfiles ban gaye hain. **Yahan sandbox me
    Docker hi nahi hai, isliye `docker compose config` ya image
    build tak verify nahi hua hai** — sirf YAML syntax, Caddy
    target vs expose match, build context (repo root), aur
    `.env` gitignore check hua hai. Stalwart v1 me hand-written
    config file nahi hoti (first run par khud banti hai), isliye
    koi nakli stalwart.toml nahi likha gaya hai — asli settings
    WebUI se set hongi (mail-server README me first-run
    checklist hai). VPS run + DNS + mail-tester proof abhi bhi
    tumhare VPS par baaki hai.
11. **Backup + monitoring slice (v1, 31 Oct 2026):**
    compose me Uptime Kuma service (image 2.5.8 pinned,
    dashboard sirf 127.0.0.1:3001 par),
    `scripts/backup.sh` (data pehle, R2 baad me, Stalwart stop
    karke tar, trap se wapas start, retention 7 din),
    `scripts/disk-alert.sh` (80% threshold, external webhook),
    aur `MONITORING-BACKUP.md` runbook. **Verify sirf YAML
    syntax + `bash -n` tak hua hai** — Docker yahan nahi hai,
    isliye compose run, backup run, aur Uptime Kuma monitors
    VPS par first run me verify karne hain. Fail2ban, CPU/RAM
    tool, alert channel ka final naam, aur automated queue
    alert abhi bhi OPEN hain (runbook me likha hai).
12. **Parallel backend batch (31 Oct 2026, 5 workers + coordinator
    integration):** return_to validation (auth-api, docs/28 rules
    exactly, 13 naye tests), shared @dusrel/address package
    (auth-api + mail-api dono migrate, drift khatam), @dusrel/crypto
    package (BIP39, Argon2id raw, AES-GCM, OpenPGP v6), tooling
    (turbo.json, ESLint flat config, Prettier — existing build/test
    scripts untouched), deploy workflow (GHCR build hamesha +
    Render/VPS steps sirf jab secrets set hon). **Coordinator ke
    faisle (workers ne khud nahi badle):** (a) fingerprint schema
    40-or-64 hex tak badhaya gaya (v6 keys 64 hex hoti hain, warna
    crypto keys publish nahi hoti); (b) VPS deploy step me
    `up -d --build` lagaya (bina iske compose `build:` wali API
    purani rehti); (c) address/crypto package ka tsconfig
    `src+test` + test scripts jode (warna tests compile hi nahi
    hote); (d) CI me address/crypto test steps jode; (e) return_to
    over-long input par 400 rakha gaya hai (DoS guard, fallback
    se alag). **OPEN (integration ke baad bhi):** typescript-eslint
    ka peer range TS 7 ko cover nahi karta — eslint run par check
    karna hai; asli Render/VPS deploy secrets ke bina verify nahi
    hua hai.
13. **mail-api gaps slice (v1, 31 Oct 2026):**
    `GET /mail/quota` (5 GB starting proposal, usage JMAP se),
    settings GET/PUT (signature auto-append nahi hota),
    alias-send ownership check (403 warna), search polish
    (body/to/cc + unreadOnly/flaggedOnly, enum boolean parsing),
    key anti-probing test se prove (contract unchanged — dono
    cases ko pehle se identical 404 milta tha). **Tests:
    mail-api 6 se 11 ho gaye, auth-api 11/11 wahi.** Sieve
    app-level hissa aur password-protected link is slice me
    nahi hain (Phase 2 / Phase 3, upar README me likha hai).
