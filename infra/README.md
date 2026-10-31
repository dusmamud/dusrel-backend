# infra — Docker / Caddy / VPS / Render (scope doc + v1 config)

Karega: Har service ka Dockerfile plan, VPS Docker Compose plan,
Caddy reverse proxy plan, Render service plan — bina secret ke.

**v1 config ab maujood hai (31 Oct 2026):** VPS stack ki asli
files `services/mail-server/` me hain — `docker-compose.yml`
(Stalwart + Caddy + auth-api + mail-api), `Caddyfile`, `.env.example`,
aur `services/auth-api/Dockerfile` + `services/mail-api/Dockerfile`.
Is folder me abhi bhi koi config nahi hai — ye folder deploy map
ka pointer hai, config us service ke folder me rehti hai jise wo
chalati hai. Render deploy workflow abhi bhi plan-only hai
(CI workflow ke alawa koi deploy workflow nahi hai).

Nahi karega: Secret, API key, DB connection string, R2 keys,
DKIM private key — ye sab env / Secure Vault me rahenge, kabhi
is folder me nahi.

Deploy map ka sach `docs/09-deployment.md` me hai:
Stalwart + LiveKit VPS-only, Hono APIs Render/VPS, web apps Cloudflare Pages.
