# GitHub Actions

## CI workflow (bana hua hai)

- `ci.yml` — har push/PR par `main` ke liye: pnpm install
  (`--frozen-lockfile`), `pnpm -r build` (TypeScript), phir har
  service ke tests alag step me: auth-api, mail-api. Ye workflow
  2026-10-31 ko user ke order par bana hai ("har ek test GitHub
  workflow se verify ho").

## Deploy workflow (backend only — `deploy.yml`)

`deploy.yml` backend deploy karta hai: Docker -> GHCR -> Render
hook ya VPS pull. Web app deploy (Pages/wrangler) isme NAHI hai
— wo alag workflow hoga jab uske liye approval milega.

### Trigger

- Manual: workflow_dispatch (Actions tab se haath se chalao).
- Push to `main`, SIRF jab ye paths badlen:
  `services/auth-api/**`, `services/mail-api/**`, `packages/**`,
  ya dono Dockerfiles. Docs-only push par deploy nahi chalega.

### Jobs aur unki conditions

Jobs ek doosre se independent hain — har job sirf apni condition
dekhta hai:

1. **build-images (hamesha chalta hai):** auth-api aur mail-api
   ke Dockerfiles se images build karke GHCR par push karta hai:
   `ghcr.io/dusmamud/dusrel-auth-api` aur
   `ghcr.io/dusmamud/dusrel-mail-api` (tags: `latest` + commit
   SHA). Build context repo root hai (Dockerfiles workspace files
   copy karte hain). Isse Dockerfiles pehli baar CI par verify
   bhi ho jayenge. GHCR login ke liye koi extra secret nahi
   chahiye — built-in `GITHUB_TOKEN` + workflow permissions
   (`contents: read`, `packages: write`) kaafi hain.
2. **deploy-render (sirf jab hook secrets set hon):** job tabhi
   chalta hai jab `RENDER_AUTH_DEPLOY_HOOK` ya
   `RENDER_MAIL_DEPLOY_HOOK` me se koi ek set ho; har hook ka
   step apni condition se chalta hai (ek set, doosra nahi to
   sirf set wala trigger hoga). Hook ko `curl -X POST` se
   trigger kiya jata hai. Hook URLs kabhi file me hardcode nahi
   hain — sirf secrets se aati hain.
3. **deploy-vps (sirf jab chaaron VPS secrets set hon):** job
   tabhi chalta hai jab `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`
   aur `VPS_COMPOSE_DIR` chaaron set hon (koi ek missing ho to
   poora job skip hoga). VPS par ye commands chalti hain:
   `git pull --ff-only origin main`, `docker compose pull`,
   `docker compose up -d`, `docker compose ps`.

### Required secrets (GitHub Secrets me set karo, file me kabhi nahi)

| Secret | Kis liye | Kab zaroori |
|---|---|---|
| (koi nahi — `GITHUB_TOKEN` built-in hai) | GHCR login/push | Hamesha (Job 1) |
| `RENDER_AUTH_DEPLOY_HOOK` | auth-api ka Render deploy hook URL | Job 2, auth-api ke liye |
| `RENDER_MAIL_DEPLOY_HOOK` | mail-api ka Render deploy hook URL | Job 2, mail-api ke liye |
| `VPS_HOST` | VPS ka hostname/IP | Job 3 |
| `VPS_USER` | VPS ka SSH user | Job 3 |
| `VPS_SSH_KEY` | VPS ka SSH private key | Job 3 |
| `VPS_COMPOSE_DIR` | VPS par compose file wala directory (jahan `docker-compose.yml` hai, wahan `git pull` chalega) | Job 3 |

Koi bhi secret set nahi hai to uska step skip message dekar
success hota hai — workflow fail nahi hota (Render steps ke andar
shell check hai, VPS ke liye pehle check step ka output hai).
Ye jaan-boojh kar hai: secrets lagne se pehle bhi Dockerfiles
CI par verify ho jayen. Dhyaan rahe: `secrets` context `if:`
condition me allowed hi nahi hai — pehli push par isi wajah se
poora deploy workflow reject hua tha (actionlint se fix verify
hua hai).

### VPS deploy kaise kaam karta hai (coordinator integration fix)

VPS compose file me APIs `build:` se banti hain, `image:` se
nahi. Isliye Job 3 `pull` ke baad `up -d --build` chalata hai:
git pull se naya code aata hai, pull se base images update hote
hain, --build se API images dobara banti hain. Bina --build ke
API purani rehti — ye worker ki report par coordinator ne fix
kiya hai. GHCR `image:` tags par switch karna ek alag decision
hai, is batch me nahi hai.

### Abhi bhi plan only (is workflow me nahi hai)

- Web app deploy (Pages/wrangler) — alag workflow, alag approval.
- Deploy se pehle test/lint/typecheck gate — `ci.yml` alag job
  hai; deploy workflow khud test nahi chalata (Job 1 sirf Docker
  build karta hai). Agar deploy ko CI-green par gate karna hai to
  wo alag approval se jodega.
