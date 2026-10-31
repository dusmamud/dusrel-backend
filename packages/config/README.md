# packages/config — shared tooling config (scope doc only, no code yet)

Karega: Shared tsconfig, eslint, prettier, tailwind (backend ke
liye jahan zaroorat ho) — ek jagah se sab services me ek jaisa
tooling.

Nahi karega: Secret, env values, app-specific config.

## Code (v1)

`tsconfig.base.json` yahan hai — har package/service ka `tsconfig.json`
isi ko extend karta hai (strict mode). ESLint / Prettier config abhi
is package me nahi hai, wo agle tooling step me aayega; tab tak `tsc`
hi type gate hai.
