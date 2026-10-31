# auth-api — SSO service (scope doc only, no code yet)

Purpose: Dusrel suite ka ek hi login — mail, drive, chat, meet sab
isi se authenticate honge.

Karega: signup/login (Phase 1 me private/team only), JWT issue +
refresh + revoke, TOTP 2FA, app passwords, session list/revoke,
baad me OIDC provider (Stalwart aur apps ke liye).

Nahi karega: mail bhejna, files store karna, seed/private key ko
plaintext me lena, public signup (Phase 4 tak nahi).

Dependencies: `packages/auth`, `packages/db` (auth schema),
`packages/api-contracts` (auth Zod schemas).

Deploy: Render Web Service ya VPS Docker — stateless API hai.
Workers par HTTP code chal sakta hai, lekin is service ka mail se
koi lena dena nahi hai.
