# Client Overview — Web ke baad Android, iOS, Desktop

Status: DRAFT — 2026-10-31
Exa se cross-verify kiya gaya hai (Android Developers, Apple/Swift
best practice, Tauri vs Electron comparison, OWASP Mobile Security).

## Scope — ye docs kis liye hain, code kahan hoga

- Is repo (`dusrel-backend`) me client apps ka **sirf planning/spec
  doc** hai. Client ka asli code is repo me nahi aayega.
- Client code ke repo alag honge, jab user us platform ke liye
  "code likho" bolega:
  - Android native: alag Android repo (Kotlin)
  - iOS Swift: alag iOS repo (Swift)
  - Desktop: alag desktop repo (Tauri)
- Ye decision pehle wale "native apps separate repo" wale rule ko
  badalta nahi hai — sirf docs yahan central rahenge taaki backend
  API, auth aur crypto ka sach ek jagah rahe.

## Ek hi backend, teen alag native experience

| Client | Language / UI | Backend se kaise judega |
|---|---|---|
| Web (pehla client) | Next.js, Cloudflare Pages — poora spec `docs/20-web-app.md` me hai | REST + JMAP |
| Android native | Kotlin + Jetpack Compose | REST + IMAP/JMAP (mail), REST (drive/chat/meet) |
| iOS Swift | Swift + SwiftUI | REST + IMAP/JMAP (mail), REST (drive/chat/meet) |
| Desktop | Tauri v2 (Rust + web frontend) | REST + JMAP, local OS keychain ke saath |

Koi client backend ka logic copy nahi karega. Business rule,
validation aur permission server par hi rahenge. Client sirf UI,
local cache aur crypto (browser/device key) ka kaam karega.

## Shared — teenon client me ek jaisa kya hoga

1. **Ek hi API contract:** `docs/05-api-contracts.md` wala REST +
   Zod/OpenAPI. Android, iOS aur Desktop teeno wahi contract use
   karenge, apne-apne typed client ke saath.
2. **Ek hi auth:** `services/auth-api/` se SSO, JWT + refresh,
   TOTP, app passwords. Har client me login flow alag dikh sakta
   hai, lekin token ka format aur refresh ka rule ek hi hoga.
3. **Ek hi crypto design, alag implementation:** Seed phrase,
   OpenPGP Curve25519, Argon2id — design ek hai, lekin Android me
   Kotlin implementation, iOS me Swift implementation, Desktop me
   Rust/JS implementation hogi. Koi bhi client apna custom crypto
   format nahi banayega, warna ek client ka mail dusre me nahi
   khulega.
4. **Ek hi design language, platform guidelines ke saath:**
   Dusrel ke rang, logo aur tone ek honge, lekin Android Material 3
   guidelines aur iOS Human Interface Guidelines ki izzat hogi.
   Android app ko iOS jaisa ya iOS app ko Android jaisa jabardasti
   nahi banaya jayega.
5. **Ek hi offline rule:** Local data source hi UI ka source of
   truth hoga, network sirf sync karega (Android docs ka offline-first
   rule, iOS/Desktop par bhi wahi principle). Matlab: UI local data ko source maan kar dikhayega, lekin final sach server hi hoga (`docs/19-client-security-sync.md` ke hisaab se).

## Alag — har platform me kya alag hoga

- **UI toolkit:** Android Compose, iOS SwiftUI, Desktop web frontend
  (Tauri WebView) — koi cross-platform UI framework (Flutter /
  React Native) is plan me nahi hai, kyunki user ne native Android
  aur Swift iOS alag se manga hai.
- **Local storage:** Android Room, iOS SwiftData, Desktop local
  SQLite / Tauri store — naam alag, kaam ek: offline cache.
- **Secure storage:** Android Keystore, iOS Keychain + Secure
  Enclave, Desktop OS keychain (Windows Credential Manager /
  macOS Keychain / Linux Secret Service via Tauri plugin).
- **Push / notifications:** Android FCM, iOS APNs, Desktop OS
  notifications — har ek ka alag setup, backend se ek hi event
  format jayega.
- **Store / distribution:** Android Play Store, iOS App Store,
  Desktop direct installer + auto-update (Tauri updater, signing
  ke saath). Store listing, privacy questionnaire aur review rules
  har platform ke alag honge — ye code se pehle alag checklist
  banegi.

## Order — kaun sa client pehle

Web ke baad order abhi lock nahi hai, lekin docs ka order ye hai:

1. Android native — user ka apna phone aur pehle wala Notes app ka
   experience isi platform par hai.
2. iOS Swift — Android ke baad, jab API stable ho jaye, taaki iOS
   me API dobara na badle.
3. Desktop (Tauri) — web frontend reuse hone ki wajah se iska kaam
   Android/iOS se kam hoga; docs order me Desktop teesra hai (Windows pehle, phir macOS, phir Linux — `docs/18-desktop.md` ka sequence), final launch order user confirm karega.

Koi client tabhi shuru hoga jab uska backend API (mail/drive/chat)
stable ho. API badalte hue client banana dobara kaam badhata hai.

## Kya nahi hoga — client me

- Client me backend ka secret, R2 key, DB connection string kabhi
  nahi hogi. Client ko sirf user ka token aur presigned URL milega.
- Client me mail body, password, seed ya private key log nahi hogi.
- Client server ki permission ko bypass nahi karega — client-side
  check sirf UX ke liye hai, asli check server par hi hoga
  (OWASP Mobile ka pehla rule: client par bharosa mat karo).
