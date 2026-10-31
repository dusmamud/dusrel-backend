# auth-api — SSO service (code, v1 slice)

Purpose: Dusrel suite ka ek hi login — mail, drive, chat, meet sab
isi se authenticate honge.

Karega (v1, implemented + tested):
- Admin (Owner/Admin) user create + first-login invite, invite accept
- Login (generic 401, no enumeration), JWT access token + rotating
  refresh token, logout, session list/revoke/revoke-all
- Password change (old password required, reset links invalidated),
  forgot password (same message hamesha, link sirf verified secondary
  email par), reset password (single-use hashed token, 1 ghanta,
  no auto-login, saare sessions invalidated)
- Secondary email: OTP request + verify (6 digits, 10 minute, 5 attempts)
- TOTP 2FA: setup (secret + otpauth URL), verify (backup codes once),
  disable (password + existing factor se re-auth)
- App passwords: create (once dikhta hai), list (secret kabhi nahi),
  revoke; IMAP ke liye `verifyAppPassword` service function
- Admin: user list, state change (active/disabled/suspended/banned),
  soft delete, audit log (metadata only — kabhi mail body, password,
  seed, key ya token nahi)

Nahi karega: mail bhejna (mail sender interface hai, real Stalwart
sender baad me), files store karna, seed/private key ko plaintext me
lena, public signup (Phase 4 tak nahi), OIDC provider (baad me).

Dependencies: `packages/auth`, `packages/api-contracts` (Zod schemas).
`packages/db` ka schema definition ke taur par hai — runtime store
abhi in-memory hai (ADR-004 OPEN hone ki wajah se, dekho neeche).

Deploy: Render Web Service ya VPS Docker — stateless API hai.
Workers par HTTP code chal sakta hai, lekin is service ka mail se
koi lena dena nahi hai. Backend Workers par separately host nahi
hoga (tumhara 2026-10-31 ka clarification) — main plan Render/VPS
hi hai.

## Run / test

```sh
npx -y pnpm@10.19.0 install
npx -y pnpm@10.19.0 -r build
cd services/auth-api
AUTH_JWT_SECRET=dev-only-change-me node dist/src/index.js
# health: curl http://localhost:3001/health
npx -y pnpm@10.19.0 --filter @dusrel/auth-api test
```

## Imaandaar limits (v1)

1. **Store in-memory hai** — restart par sab khatam. Postgres repo
   tab wire hoga jab ADR-004 (Cockroach vs cheaper Postgres) lock
   hoga aur Stalwart-on-Cockroach test pass hoga.
2. **Mail sender dev wala hai** — running server `LogMailSender`
   use karta hai (sirf to/subject log, text kabhi nahi). Asli
   Stalwart sender VPS step me aayega. Tests `CapturingMailSender`
   use karte hain.
3. **App-password rule (code choice, docs lock nahi):** Plain
   password change par app passwords bachte hain; sirf
   "revoke all sessions" chunne par ya alag se revoke karne par
   khatam hote hain. Docs me ye rule abhi contradiction me hai.
4. **Numbers starting values hain:** access 15 min, refresh 30 din,
   reset 1 ghanta, invite 24 ghante, OTP 10 min / 5 attempts,
   login rate limits — sab `src/config.ts` me, lock code phase me.
