# GitHub Actions

## CI workflow (bana hua hai)

- `ci.yml` — har push/PR par `main` ke liye: pnpm install
  (`--frozen-lockfile`), `pnpm -r build` (TypeScript), phir har
  service ke tests alag step me: auth-api, mail-api. Ye workflow
  2026-10-31 ko user ke order par bana hai ("har ek test GitHub
  workflow se verify ho").

## Deploy workflows (abhi bhi plan only, alag approval chahiye)

Plan (detail `docs/09-deployment.md` me):

Plan (detail `docs/09-deployment.md` me):

- Har web app ke liye alag workflow: Turborepo filter se sirf wo
  app build, phir `wrangler pages deploy` Direct Upload.
- Har backend service ke liye alag workflow: Docker build -> GHCR
  push -> Render hook ya VPS pull.
- Deploy tabhi jab test/lint/typecheck pass ho.
- Secrets sirf GitHub Secrets me: CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ACCOUNT_ID, Render hook, VPS SSH key.

Deploy wali workflow `.yml` files tabhi banengi jab user us deploy
ke liye alag se approve karega. Is folder me abhi sirf `ci.yml`
hai, koi deploy workflow nahi hai.
