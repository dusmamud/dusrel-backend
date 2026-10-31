# Web App — Spec Doc (code nahi hai)

Status: DRAFT — 2026-10-31
Ye doc isliye bana hai kyunki client docs (15-19) me web app ka
sirf ek line me zikr tha, poora spec nahi tha. Ye kami thi, is doc
se theek ki ja rahi hai.

## Web app kya hai — pehla aur sabse important client

Web app Dusrel suite ka pehla client hai, aur Android / iOS /
Desktop se pehle banega. Mail ka webmail, Drive ka web UI, Chat aur
Meet ka web UI — ye sab web apps hain, alag alag Pages project par.

Web app "sirf website" nahi hai — ye poora app hai, jo browser me
chalta hai aur PWA ke taur par phone/desktop par install bhi ho
sakta hai, jab tak native app na aaye.

## Stack — web ke liye best practice

- Framework: Next.js App Router, **frontend-only mode**
- Build: static export (`out` folder) — Cloudflare Pages ke liye
  seedha deploy hota hai, isliye ye mode chuna hai
- Language: TypeScript, strict
- UI: React 19 + Tailwind v4 + Dusrel design system
  (`packages/ui` jaisa shared system, frontend repo me)
- State: Zustand (client state) + TanStack Query (server state,
  API cache, retry)
- Forms: React Hook Form + Zod (wahi Zod schemas jo backend ke
  `packages/api-contracts` me hain)
- Mail protocol: JMAP primary (Stalwart se), IMAP fallback ka
  decision code phase me lock hoga — dono parallel nahi chalenge
- PWA: manifest + service worker (Serwist jaisa Next.js
  integration, code phase me ek lock hoga) + install prompt
- Icons / branding: Dusrel logo, Poppins jaisi brand font ka
  faisla frontend repo me lock hoga, har web app me ek hi hoga

## Kyu frontend-only, SSR kyu nahi (pehle se decide hua)

- Backend alag Hono services par hai, isliye Next.js me Server
  Actions ya server-side backend logic nahi likhna — warna logic
  do jagah bat jayega.
- Static export se Pages deploy seedha, sasta aur reliable hai —
  Cloudflare Pages docs me Next.js static export ka rasta isi
  liye diya gaya hai.
- Agar kal SSR / server features chahiye hue to wahi code
  vinext / Workers rasta apna sakta hai (Cloudflare ka naya
  recommended rasta), lekin tab alag ADR banega. Abhi static hi
  default hai.
- Static export me jo cheezein nahi chalengi, wo pehle se saaf
  hain: Server Actions, server-side headers (wo proxy / Pages
  `_headers` se honge), aur dynamic server rendering. Inka
  workaround API client se hoga, server logic se nahi.

## Har web app — mail, drive, chat, meet, landing

| Web app | Pages project (example) | Kaam |
|---|---|---|
| mail | mail.dusrel.com | Inbox, compose, reply, folders, alias, E2EE webmail |
| drive | drive.dusrel.com | Files, folders, sharing, upload/download |
| chat | chat.dusrel.com | Rooms, messages, WebSocket |
| meet | meet.dusrel.com | LiveKit rooms, video UI |
| landing | dusrel.com | Product page, login link, privacy/terms link |

Har web app ka alag Pages project, alag env (`NEXT_PUBLIC_API_URL`
us app ke backend ka), alag deploy workflow hoga — ek app ka deploy
dusre ko tode nahi.

## PWA best practice — MDN / Next.js docs se verified

- **Responsive:** har screen size par kaam karega — mobile, tablet,
  desktop. Semantic HTML use hoga, custom button/div se accessibility
  nahi todi jayegi.
- **Offline:** kam se kam custom offline page to hoga hi, aur
  aage chalkar poora offline operation hoga — jaise mail compose
  karke Send dabane par offline ho to mail locally save hoke
  online aate hi auto-send hoga. Yehi rule Android/iOS offline
  rule se match karta hai.
- **Fast:** pehla load tez hona chahiye — bundle size, image
  optimization, aur route-level code splitting ka dhyan rakhna hai.
  Slow web app ko native app replace nahi karega, web app khud tez
  honi chahiye.
- **Accessible:** keyboard, mouse aur touch — teeno input se saara
  kaam hona chahiye. Accessibility koi optional feature nahi hai.
- **Installable:** manifest, icons (192/512, maskable), theme
  color, aur install prompt ka sahi flow hoga. Install hone ke
  baad bhi wahi login, wahi data milega — alag account nahi banega.

## E2EE — web par kaise hoga (sabse important)

- Seed phrase, keypair aur encrypt/decrypt **browser me** hoga —
  OpenPGP.js + WebCrypto + IndexedDB (detail `docs/07-...` me hai).
- Private key kabhi server ko nahi jayegi, aur service worker ke
  cache me plaintext mail nahi rahega.
- Service worker ko secure rakhna hai: HTTPS hi chalega, push
  message ka source validate hoga, aur cache me sensitive data ka
  rule alag se lock hoga — service worker me mail body cache karna
  mana hai jab tak encryption ka rule na ban jaye.
- Draft autosave plaintext rahega jab tak draft encryption alag se
  na ban jaye — ye limit UI me saaf dikhani hai, chhupani nahi.

## Security — web best practice

- HTTPS only, HSTS, CSP headers Pages `_headers` se.
- Token storage: access token memory me prefer hoga, refresh token
  ka storage rule (httpOnly cookie vs local storage) code phase me
  security review ke baad lock hoga — abhi dono me se ek ko final
  mat samajhna. Token kabhi URL me nahi jayega.
- XSS: mail ka HTML DOMPurify + sandboxed iframe jaisi sanitization
  ke saath render hoga, seedha `innerHTML` kabhi nahi.
- CORS: sirf allowlisted backend origins, `*` nahi.
- Logs: browser console me token/key/mail body kabhi nahi aayega,
  debug build me bhi nahi.

## SEO / Landing — sirf landing app ke liye

- Landing page (dusrel.com) par SEO, meta tags, sitemap, aur
  performance ka dhyan hoga.
- App pages (mail/drive/chat/meet) login ke peeche hain, unka SEO
  goal nahi hai — unpar `noindex` jaisa rule login pages ke
  hisaab se lagega, taaki private app search me na aaye.

## Web vs Native — farq saaf rakhna hai

- Web app sabse pehle aayegi, native apps uske baad.
- Web app native app ka replacement nahi hai — push, widget,
  background sync, aur OS integration me native aage rahega.
- Lekin web app ka API, auth aur crypto design native apps ke
  saath ek hi hoga, taaki ek ka mail dusre me khul sake.
- Desktop Tauri app isi web frontend ko reuse karegi — isliye web
  frontend ko Tauri ke liye bhi clean rakhna hai, desktop-only
  hack web code me nahi dalna hai.
