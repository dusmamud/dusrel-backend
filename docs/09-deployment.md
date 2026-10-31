# Deployment — kya kahan deploy hoga

Status: DRAFT — 2026-10-31

## Deploy map — final for docs

| Cheez | Kahan deploy hogi | Kaise |
|---|---|---|
| Web apps (mail/drive/chat/meet/landing) | Cloudflare Pages, har app alag project | GitHub Actions -> `wrangler pages deploy` Direct Upload |
| Hono APIs (auth/mail/drive/chat/meet) | Render Web Service YA VPS Docker | Docker image -> Render deploy hook / VPS compose pull |
| Stalwart mail server | VPS ONLY | Docker Compose on Ubuntu VPS |
| LiveKit + TURN (future Meet) | VPS ONLY | Docker Compose on Ubuntu VPS, UDP ports ke saath |
| CockroachDB | Cockroach Cloud (managed) | Koi VPS deploy nahi |
| R2 | Cloudflare (managed) | Koi VPS deploy nahi |

### Workers ka sahi scope — dobara, kyunki ye galti ho chuki hai

- Workers par ja sakta hai: Hono HTTP API, frontend (vinext/Workers
  rasta, agar SSR chahiye ho to).
- Workers par NAHI ja sakta hai: Stalwart mail server, LiveKit media.
- Reason: Workers par general inbound TCP listener nahi hai,
  outbound port 25 prohibited hai, dedicated IP / PTR nahi milta.
- Is doc ke baad koi bhi deployment plan is scope ko tode to wo
  plan galat hai, use turant correct karna hai.

## GitHub Actions — plan (workflow files abhi nahi banengi)

`.github/workflows/` me abhi sirf README hoga. Workflow files tabhi
banengi jab user us deploy ke liye approve karega. Plan ye hai:

- Har web app ke liye alag workflow: Turborepo filter se sirf wo app
  build hogi, baaki cache se skip hogi.
- Har backend service ke liye alag workflow: Docker build -> GHCR
  push -> Render hook ya VPS pull.
- Deploy job tabhi chalegi jab test/lint/typecheck pass ho.
- Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
  Render deploy hook, VPS SSH key — sab GitHub Secrets me, kabhi
  code me nahi.
- Pages ke liye Direct Upload pattern use hoga (Git integration
  nahi), taaki Cloudflare ka 500 builds/month limit kharch na ho —
  ye pattern ShrinkIt me pehle use ho chuka hai.
- Concurrency: ek service ka ek deploy ek waqt me, parallel deploy
  se race nahi honi chahiye.

## VPS badalna — 3-4 din baad wala plan (pehle se decide hua)

1. Pehle se DNS TTL low rakho (300 second).
2. Naye VPS par wahi Docker Compose, wahi env (naye secrets ke
   saath), wahi Cockroach connection, wahi R2 keys se deploy karo.
3. Cockroach IP allowlist me naye VPS ka IP add karo, warna naya
   VPS connect hi nahi hoga.
4. DNS A record naye IP par badlo, PTR naye VPS provider se set karo.
5. SPF `mx` wala ho to dobara badalne ki zaroorat nahi; DKIM key
   wahi rakho to DKIM nahi tootega.
6. Purana VPS 24-48 ghante parallel chalao taaki queue drain ho jaye,
   phir band karo.
7. Naye IP ki reputation zero se shuru hogi — warmup phir se dhyan
   me rakho.

Ye tabhi aasan hai jab state VPS disk par nahi hai. Agar kisi service
ne local disk par source-of-truth rakh liya to ye plan toot jayega,
aur use turant fix karna hoga.

## Environment — dev / staging / prod

- Dev: local Docker, test Cockroach/R2 (alag bucket/schema).
- Staging: Render/VPS par, prod jaisa lekin alag domain/bucket.
- Prod: sirf main branch se, test pass hone ke baad, manual approval
  ke saath (Phase 1 me manual approval hi rahega, auto-prod nahi).
- Env vars per environment alag hongi, naam same rahenge, values
  kabhi Git me nahi hongi.

## Rollback

- Har deploy ka pehla version (Docker image tag / Pages deployment)
  rollback ke liye rakha jayega.
- DB migration rollback ka plan har migration ke saath likhna hai —
  bina rollback plan ke migration prod par nahi chalegi.
- Rollback ka matlab sirf code wapas lana nahi hai — DNS, PTR aur
  allowlist bhi check karne hain agar VPS badla ho.
