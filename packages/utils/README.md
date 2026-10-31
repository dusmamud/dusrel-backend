# packages/utils — shared pure utils (scope doc only, no code yet)

Karega: Sirf pure, side-effect free helpers — date, id, validation
jaise chhote kaam jo har service me chahiye.

Nahi karega: DB call, API call, secret access, app-specific logic.
Circular dependency nahi hogi: utils kisi aur package ko import
nahi karega.

## Code (v1)

`src/index.ts` me base32 encode/decode (TOTP secrets ke liye),
CSPRNG hex/integer helpers aur constant-time hex comparison hai.
Koi runtime dependency nahi hai (sirf Node built-ins + dev me
TypeScript / @types/node).
