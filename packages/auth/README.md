# packages/auth — shared auth helpers (scope doc only, no code yet)

Karega: JWT verify helpers, TOTP helpers, password hashing
(Argon2id) helpers, app password helpers — jo har service use karegi.

Nahi karega: kisi ek app ka login UI, mail bhejna, seed/key ko
plaintext me lena.

Rule: Is package me koi secret, hardcode URL ya app-specific logic
nahi hoga.

## Code (v1)

`src/index.ts` me hai: Argon2id password hashing (OWASP parameters:
19 MiB, 2 iterations, 1 lane), TOTP RFC 6238 (SHA-1, 30s, 6 digits,
window ±1), HS256 JWT (Node crypto se, koi JWT library nahi),
SHA-256 token hashing (token kabhi plaintext store nahi hoga),
secure token / OTP / backup codes / app password generation.
Runtime dependencies: `argon2` + `@dusrel/utils` hi hain.
