# packages/api-contracts — shared Zod schemas (scope doc only, no code yet)

Karega: Har API ke request/response ke Zod schemas, jo frontend
aur backend dono use karenge. REST + OpenAPI ka ek hi sach yahan
hoga.

Nahi karega: tRPC lock-in (future Kotlin app ke liye REST hi
rahega), bina version ke breaking change.

Rule: Bina schema ke koi endpoint nahi banega.

## Code (v1)

`src/index.ts` me auth-api ke saare request schemas hain (login,
refresh, password change/forgot/reset, TOTP verify/disable, app
password create, admin create/state, invite accept). Password rule
starting value hai: 10–128 characters — final policy code phase me
lock hogi.
