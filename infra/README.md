# infra — Docker / Caddy / VPS / Render (scope doc only, no config yet)

Karega (jab user approve karega): Har service ka Dockerfile plan,
VPS Docker Compose plan, Caddy reverse proxy plan, Render service
plan — bina secret ke.

Nahi karega: Secret, API key, DB connection string, R2 keys,
DKIM private key — ye sab env / Secure Vault me rahenge, kabhi
is folder me nahi.

Deploy map ka sach `docs/09-deployment.md` me hai:
Stalwart + LiveKit VPS-only, Hono APIs Render/VPS, web apps Pages.
