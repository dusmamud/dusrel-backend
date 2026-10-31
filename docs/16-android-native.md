# Android Native App — Spec Doc (code nahi hai)

Status: DRAFT — 2026-10-31
Exa verified: Android Developers offline-first + architecture docs.

## Stack — Android ke liye best practice

- Language: Kotlin, 100% Kotlin (Java legacy code nahi)
- UI: Jetpack Compose + Material 3, single-activity architecture
- Architecture: MVVM — UI layer (Compose + ViewModel + StateFlow)
  / Domain layer (use cases, repositories) / Data layer
  (repository + local + network) — Android Developers ka official
  layer pattern
- DI: Hilt (ya Koin, code phase me ek lock hoga, dono mix nahi)
- Networking: Retrofit + OkHttp, ya Ktor — ek hi client poore app
  me, har screen apna client nahi banayegi
- Local DB: Room (structured data) + DataStore (settings, chhoti
  preferences) — local source of truth
- Background sync: WorkManager (periodic sync, constraints ke
  saath: charging / Wi-Fi par bada sync)
- Navigation: Navigation Compose, type-safe routes
- Build: Gradle (Kotlin DSL), version catalog, minSdk/targetSdk
  code phase me lock honge — abhi guess karke number mat likhna
- Testing: JUnit + Turbine (Flow), Compose UI tests, screenshot
  tests jahan UI critical ho

## Offline-first — sabse bada rule

Android Developers ka rule is app par lagu hai:

- UI hamesha local data source (Room) ko observe karegi —
  `StateFlow` + `collectAsStateWithLifecycle()` pattern se.
- Network sirf local ko sync karega, UI kabhi seedha network se
  nahi padhegi.
- Read bina internet ke chalna hi chahiye — inbox, pehle khula
  mail, folders offline dikhne chahiye.
- Write offline queue hogi: mail bhejna, draft save, folder move — draft ka plaintext/disclosure rule `docs/20-web-app.md` ke saath align hoga, code phase me lock hoga —
  offline ho to WorkManager se online aate hi sync hogi, user ka
  kaam khoyega nahi.
- Sync me exponential backoff hoga, har fail par turant retry nahi.

## Mail ke liye Android-specific

- Mail protocols: JMAP (web jaisa, jab Stalwart se mile) ya IMAP —
  dono me se ek primary lock hoga code phase me, dono ko parallel
  mat chalana.
- Push: FCM data messages se "naya mail hai" ka signal, poora mail
  body push me nahi aayega (privacy + size dono ke liye).
- Widgets: Notes app me widget ka experience hai, Mail me bhi
  widget baad me sochna hai — Phase 1 me widget goal nahi hai.
- Exact alarm / notification: reminder jaisi feature ho to exact
  alarm permission ka sahi use hoga, bina zaroorat ke permission
  nahi mangi jayegi.

## Security — Android best practice (OWASP verified)

- Keys: Android Keystore, hardware-backed jahan mile (TEE /
  StrongBox, Android 9+ par `setIsStrongBoxBacked(true)` jahan
  available ho). Key kabhi SharedPreferences me nahi.
- Sensitive data: EncryptedSharedPreferences / EncryptedFile,
  plain SharedPreferences me token, password, seed kabhi nahi.
- Backup: default `allowBackup=false` hoga (ya backup rules me keys/tokens explicitly exclude honge) — E2EE key backup me nahi jani chahiye, warna seed ka matlab khatam ho jayega. Sirf security review ke override par hi alag rule hoga.
- Biometric: BiometricPrompt (platform method) + fallback PIN —
  apna custom fingerprint UI nahi.
- Network: Certificate pinning ka decision baad me hoga (pinning
  galat lagi to app toot jayegi, isliye pehle bina pinning ke
  launch, phir evaluate). Pinning lagane par rotation + backup-pin ka plan bhi hoga, bina uske pin khud outage ka risk ban jayega. Pinning public launch se pehle evaluate karna hoga (pre-public-launch gate).
- Code: R8 / ProGuard obfuscation release build me, Play Integrity
  API ka evaluate public launch se pehle karna hoga (Phase 1 blocker nahi, pre-public-launch gate).
- Permissions: Sirf jo chahiye — notifications, network, aur
  jahan zaroorat ho wahi. Har permission ka reason UI me batana hai.

## Crypto — Android par E2EE kaise hoga

- PGP: standard PGP library (BouncyCastle-based ya PGPainless
  jaisi evaluated library) — apna PGP implementation kabhi nahi.
- Private key: Keystore-wrapped key se lock karke local store me,
  seed se derived key se — seed kabhi plaintext store nahi hogi.
- Seed import/export: user ko seed dikhane / import karne ka flow
  web jaisa hi hoga, lekin Android par screenshot / clipboard
  risk par warning dikhani hai.

## Release — Play Store

- Signing: Play App Signing, upload key alag se safe jagah par.
- Tracks: pehle internal track, phir closed track, phir production
  — seedha production par nahi.
- Versioning: versionCode kabhi reuse nahi hoga, har release par
  badhega (ye lesson ShrinkIt Android se pehle se locked hai).
- Privacy: Data safety form, permissions ka declaration, aur
  E2EE limits ka store listing me saaf zikr — jhootha "fully
  encrypted" dawa nahi.
