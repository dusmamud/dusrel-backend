# GitHub Actions — plan only, workflow files abhi nahi banengi

Plan (detail `docs/09-deployment.md` me):

- Har web app ke liye alag workflow: Turborepo filter se sirf wo
  app build, phir `wrangler pages deploy` Direct Upload.
- Har backend service ke liye alag workflow: Docker build -> GHCR
  push -> Render hook ya VPS pull.
- Deploy tabhi jab test/lint/typecheck pass ho.
- Secrets sirf GitHub Secrets me: CLOUDFLARE_API_TOKEN,
  CLOUDFLARE_ACCOUNT_ID, Render hook, VPS SSH key.

Workflow `.yml` files tabhi banengi jab user us deploy ke liye
alag se approve karega. Abhi is folder me koi workflow file nahi
hai, sirf ye plan hai.
