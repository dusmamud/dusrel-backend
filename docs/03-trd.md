# TRD — Technical Requirements Document

Status: DRAFT — 2026-10-31

## 1. Tech stack — final for docs (lock pending user approval)

| Layer | Choice | Kyu |
|---|---|---|
| Language | TypeScript, strict | Frontend + backend ek language, type safety, ecosystem |
| Monorepo | pnpm workspaces + Turborepo | JS/TS-only suite ke liye caching + per-app filter deploy |
| Frontend (is folder ke bahar) | Next.js App Router, frontend-only, static export | Cloudflare Pages par seedha deploy, backend alag rahega |
| Backend framework | Hono + Zod | Web Standards, Node/Render/VPS/Workers par HTTP code portable, halka |
| ORM | Drizzle ORM | SQL-like, lightweight, Cockroach ke liye native pg driver |
| Database | CockroachDB Cloud, single region | App metadata ke liye; distributed scale ka option khula rahega |
| Object storage | Cloudflare R2, Standard class | S3-compatible, egress free, mail blobs + Drive files |
| Mail server | Stalwart (Rust, infra) | JMAP/IMAP/SMTP ek server, built-in DKIM/SPF/DMARC, S3 backend |
| Meet media | LiveKit (Go SFU, infra) | Khud SFU nahi banana, E2EE support, SDKs ready |
| Reverse proxy (VPS) | Caddy | Auto HTTPS, simple config |
| OS / Deploy (VPS) | Ubuntu 24.04 LTS, Docker + Compose | Port 25 + PTR ke liye VPS zaroori hai |

## 2. Hard constraints — inhe todna nahi hai

1. **Mail server VPS-only.** Stalwart ko Workers, Pages ya Render ke
   mail kaam par nahi chalaya jayega. Reason: Workers par general
   inbound TCP listener nahi hai, outbound port 25 prohibited hai,
   dedicated IP / PTR nahi milta. (Correction — README me bhi locked.)
2. **Hono portability ka sahi scope.** Sirf HTTP API handlers
   portable hain. SMTP/IMAP/JMAP, LiveKit media, aur long-running
   daemon is scope me nahi aate.
3. **State VPS disk par nahi.** Metadata Cockroach, blobs R2.
   VPS disk par sirf cache / temp ho sakta hai, source of truth nahi.
4. **Server par plaintext key nahi.** Private key, seed phrase,
   password kabhi server par plaintext me store ya log nahi honge.
5. **No secret in Git.** Connection string, R2 keys, DKIM private key,
   JWT secret — sab env / Secure Vault.
6. **Mail body Cockroach me nahi.** Cockroach me sirf metadata,
   public keys, aur seed-encrypted private-key backup. Body R2 me
   ciphertext (E2EE) ya Stalwart blob store ke through R2 me.
7. **Frontend me backend logic nahi.** Next.js Server Actions me
   backend logic nahi likhna — backend Hono services me rahega,
   warna do jagah logic bat jayega.

## 3. Performance / scale targets — Phase 1 (realistic, overclaim nahi)

- Phase 1 target: personal + team use, na ki lakh users. Scale ka
  dawa tabhi karna jab load test ho.
- API response: p95 target baad me load test se lock hoga; abhi koi
  number claim nahi karna.
- Mail size limit, attachment limit, quota — implementation se pehle
  user se lock karwana hai; TRD me abhi placeholder hai, number
  guess karke mat likhna.
- Cockroach: single region Phase 1 me. Multi-region sirf tab jab
  global latency ka real problem dikhe, warna cost aur complexity
  dono badhenge.

## 4. Cost — verified numbers (2026-10-31 Exa check)

- Domain + VPS: already owned — extra 0 (renewal alag se jo pehle se
  hai).
- Stalwart, Hono, Drizzle, LiveKit (self-host), Caddy, Let's Encrypt:
  free / open source.
- R2 Standard: $0.015 / GB-month, Class A $4.50 / million, Class B
  $0.36 / million, egress free. Free tier: 10 GB + 1M Class A + 10M
  Class B per month.
- CockroachDB Cloud/Continuum: naye org ko 30-day trial + $400
  credit. Uske baad Standard $0.092 / vCPU-hour; vendor example
  ~$203/mo for 2 vCPU + 100 GB (region ke hisaab se alag). **Yehi
  sabse bada cost risk hai.**
- Isliye Cockroach ka cheaper variant (managed Postgres / VPS
  Postgres) ka decision abhi OPEN hai — dekho `12-decisions-adr.md`
  ADR-004. TRD me Cockroach ko default maan kar docs likhe gaye
  hain, lekin lock nahi hai.

## 5. Security requirements (detail `07-security-e2ee.md` me)

- TLS 1.3 har jagah, HSTS, CSP (frontend par).
- Password hashing: Argon2id (server par login password ke liye).
- TOTP 2FA, app passwords for IMAP clients.
- Rate limiting: login, signup (baad me), mail send, API.
- CORS: sirf allowlisted frontend origins, `*` nahi.
- Input validation: har API par Zod schema, bina validation ke koi
  endpoint nahi.
- Audit log: login, key change, alias change, admin action — bina
  mail body ke.

## 6. Compatibility

- Mail clients: Thunderbird, Apple Mail, FairEmail jaise standard
  IMAP/SMTP clients chalne chahiye (E2EE mail sirf webmail me
  decrypt hoga — ye limit user ko batani hai).
- Browsers: modern Chrome / Firefox / Safari / Edge. WebCrypto aur
  IndexedDB zaroori hai E2EE ke liye; purane browser par E2EE mode
  disable dikhana hai, silently plaintext par mat girna.
- Mobile: Phase 1 me PWA webmail; native app alag repo me baad me.

## 7. Non-functional non-goals

- 99.99% uptime ka wada Phase 1 me nahi — single VPS par ye claim
  jhooth hoga.
- Real-time guarantees Meet ke liye LiveKit par depend karenge, apne
  upar nahi.
- E2EE mail par server-side search, spam body scan, AI summary
  possible nahi — ye feature nahi, design ki limit hai.
