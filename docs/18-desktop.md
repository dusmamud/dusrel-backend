# Desktop App — Spec Doc (code nahi hai)

Status: DRAFT — 2026-10-31
Exa verified: Tauri vs Electron 2026 comparison.

## Stack — Desktop ke liye best practice

- Choice: **Tauri v2** — Rust backend + OS WebView + web frontend
  (wahi Next.js web app ka frontend reuse hoga, jahan possible ho).
- Kyu Tauri, Electron kyu nahi (default):
  - Installer size: Tauri aksar 3-15 MB, Electron aksar 50-150 MB
    (Chromium + Node bundle ki wajah se).
  - Idle memory: Tauri aksar 20-100 MB, Electron aksar 100-300 MB.
  - Security defaults: Tauri v2 me capabilities scoped hoti hain —
    kaun si window kaun sa plugin / filesystem path use kar sakti
    hai, ye saaf likha jata hai. Electron me bhi secure kiya ja
    sakta hai, lekin checklist ka bojh zyada hai (context isolation,
    sandbox, IPC sender validation, Node integration off).
  - Ek codebase se Windows, macOS, Linux — teeno par chalega.
- Kab Electron jeetega (fallback, alag ADR ke saath):
  - Agar Tauri ke OS WebView me koi feature (jaise koi complex
    rendering ya Chromium-specific behaviour) block kare, aur wo
    feature product ke liye zaroori ho.
  - Agar team ko sirf JavaScript chahiye aur Rust ownership nahi
    chahiye, tab bhi Electron sochna padega — lekin default Tauri
    hi rahega.
- Native WinUI / AppKit alag se nahi banega Phase 1 me — Tauri se
  teeno OS cover ho jayenge, alag native desktop app banana teesra
  codebase badhata hai.

## Tauri-specific best practice

- Capabilities: Least-privilege — har window ke liye sirf wahi
  permissions jo usko chahiye (`core:default`, scoped `fs`,
  `shell` jahan zaroori ho). Broad permission kabhi default nahi.
- Frontend-backend bridge: Tauri commands ke through, har command
  par input validation hogi, frontend se aaya data bharose layak
  nahi mana jayega.
- WebView difference: Windows (WebView2), macOS (WKWebView),
  Linux (WebKitGTK) — teeno par UI test karna hoga, sirf Windows
  par test karke "ho gaya" nahi bolna.
- Auto-update: Tauri updater + code signing (Windows + macOS
  signing, certificate kabhi Git me nahi). Update channel:
  stable / beta alag honge.
- Offline: Desktop par bhi offline-first rule lagu hai — local
  cache se inbox dikhna chahiye, network sirf sync karega.
- System tray / notifications: OS notifications ka use hoga,
  custom notification system nahi banega.

## Security — Desktop best practice

- Secrets: OS keychain — Windows Credential Manager, macOS
  Keychain, Linux Secret Service (Tauri keychain plugin ke through).
  Token, key, seed-derived material kabhi plain file me nahi.
- Local files: Mail/file cache encrypt karke rakhna hai, jahan
  E2EE lagu hota hai — plain cache me E2EE mail ki plaintext copy
  nahi rehni chahiye.
- IPC: Frontend se aane wale har command ka sender aur input
  validate hoga, aur filesystem access sirf scoped paths tak hoga.
- Remote content: Remote URL ko WebView me bina soche mat kholo —
  mail ka HTML render sandbox / sanitized hoga, webmail wale rule
  ke saath.
- Signing: Release build bina signing ke distribute nahi hogi —
  unsigned installer par OS warning aayegi aur user ka bharosa
  tootega.

## Mail / Drive / Chat / Meet — Desktop par

- Mail: wahi webmail frontend, Tauri shell me — JMAP/REST se
  backend se judega, Stalwart se seedha SMTP desktop app se nahi
  chalega (mail server hamesha VPS par hi rahega).
- Drive: File download/upload R2 presigned URL se, local folder
  sync baad me (Phase 1 me sync client goal nahi hai).
- Chat: WebSocket, desktop notifications ke saath.
- Meet: LiveKit web SDK Tauri WebView me — media LiveKit VPS se,
  desktop app se media server nahi chalega.

## Release — Desktop

- Installer: Windows (.msi / .exe), macOS (.dmg), Linux (.AppImage
  / .deb — code phase me ek lock hoga).
- Versioning: Har release par version badhega, update payload ka
  size chhota rakhna hai (Tauri ka fayda yahi hai).
- Pehla target: Windows (user ka apna laptop Windows hai), phir
  macOS, phir Linux — teeno ek saath launch karne ka wada nahi hai.
