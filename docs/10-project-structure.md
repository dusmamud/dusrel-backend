# Project Structure — folder, naming, shared rules

Status: DRAFT — 2026-10-31

## Backend folder ka structure (is folder me)

```
dusrel-backend/
  README.md
  docs/                 # is folder ke saare docs
  services/
    auth-api/           # SSO
    mail-api/           # app-level mail API
    mail-server/        # Stalwart infra, code nahi, protocol SMTP/IMAP/JMAP
    drive-api/          # future
    chat-api/           # future
    meet-api/           # future, LiveKit token/room
  packages/
    auth/               # shared auth helpers
    crypto/             # shared E2EE helpers
    db/                 # Drizzle schemas + migrations
    api-contracts/      # shared Zod schemas
    config/             # shared tsconfig / eslint / tooling config
    utils/              # shared pure utils (koi app logic nahi)
  infra/
    README.md           # Docker / Caddy / VPS / Render ka scope
  .github/workflows/
    README.md           # deploy plan, workflow files baad me
```

Web side ka structure alag repo `dusrel-web` me hai (web client monorepo: `apps/mail`, `apps/drive`, `apps/chat`, `apps/meet`, `apps/landing`, `packages/ui`, `packages/api-client`) — `README.md` me sirf is backend folder ka tree hai.
Is backend folder me frontend code kabhi nahi aayega.

Client docs ke liye alag hissa hai, code ke liye nahi:

```
clients/
  web-app/README.md          # Web spec ka link (`docs/20-web-app.md`), code is folder me nahi, `dusrel-web` repo me banega
  android-native/README.md   # Kotlin + Compose spec ka link, code alag repo me
  ios-swift/README.md        # Swift + SwiftUI spec ka link, code alag repo me
  desktop-tauri/README.md    # Tauri v2 spec ka link, code alag repo me
```

Client code is backend repo me kabhi nahi aayega — Gradle, Xcode
aur Tauri build backend repo ko bhari bana denge. Docs yahan
central rahenge taaki API/auth/crypto ka sach ek jagah rahe.

## Naming rules

- Folder: kebab-case — `mail-api`, `drive-api`, `api-contracts`
- Package naam (code aane par): `@dusrel/<name>` — jaise
  `@dusrel/crypto`, `@dusrel/db`. Abhi ye sirf naming rule hai,
  package.json abhi nahi banega.
- Service naam aur uska domain ek jaisa hoga: `mail-api` ka API
  `mail-api.dusrel.com` jaisa (final domain baad me lock hoga).
- Env var naam: `SCREAMING_SNAKE_CASE`, service prefix ke saath —
  jaise `MAIL_API_...` (final list code phase me).
- R2 bucket naam aur Cockroach schema naam service ke naam se
  match karenge, taaki koi confuse na ho.

## Shared packages ke sakht rules

1. Package kabhi app/service ko import nahi karega.
2. Package me app-specific logic nahi hoga — sirf reusable logic.
3. Package ke andar secret, API key, hardcode URL nahi hoga.
4. Har package ka apna README hoga: kya karta hai, kya nahi karta,
   kaun use karega.
5. Circular dependency nahi hogi: `crypto` -> `utils` theek hai,
   `utils` -> `crypto` nahi hoga. Aisa hua to design galat hai.
6. Breaking change ho to version aur migration note ke saath hoga,
   chup-chap nahi.

## Service ke andar ka structure — code aane par (abhi sirf rule)

Har service me ye hissa hoga (jab code likha jayega, tabhi):

- `src/routes/` — HTTP routes, sirf routing, logic service layer me
- `src/services/` — business logic
- `src/middleware/` — auth, rate limit, validation
- `src/index.ts` — entry, sirf wiring
- `README.md` — service ka scope, env vars, deploy kaise hota hai

Ye structure abhi code nahi hai, sirf rule hai taaki jab code likha
jaye to har service ek jaisi lage.

## Docs ka structure rule

- Har naya doc `docs/` me number + naam se aayega, aur
  `00-docs-index.md` me entry add hogi.
- Doc me date, status (DRAFT/LOCKED) aur "kya nahi hai" section
  hona chahiye, warna doc adhura mana jayega.
