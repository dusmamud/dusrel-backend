# web-app — scope doc only, no code yet

Web app Dusrel suite ka pehla client hai, aur iski poori spec
`docs/20-web-app.md` me hai. Is folder me web app ka code nahi hai.

Stack (docs ke liye): Next.js App Router, frontend-only, static
export, Cloudflare Pages via GitHub Actions, React + Tailwind,
TanStack Query + Zustand, PWA (manifest + service worker).

Web apps: mail, drive, chat, meet, landing — har ek ka alag Pages
project hoga, har ek isi backend (Hono services + Stalwart +
Cockroach + R2) se judega.

Web app ka code jab banega to frontend repo / monorepo ke `apps/`
hisse me banega (is backend repo me backend code ki tarah nahi),
aur ye folder sirf uska scope/link rakhega. Abhi is folder me koi
code nahi hai.
