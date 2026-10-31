# iOS Swift App — Spec Doc (code nahi hai)

Status: DRAFT — 2026-10-31
Exa verified: SwiftUI / SwiftData best practice, Apple Keychain /
Secure Enclave guidance.

## Stack — iOS ke liye best practice

- Language: Swift, 100% Swift (Objective-C legacy nahi)
- UI: SwiftUI, iOS 16+ pattern — `NavigationStack` + value-based
  navigation, `NavigationView` deprecated hai, use nahi hoga
- Architecture: Default MV + `@Observable` domain models; ViewModel
  sirf wahan jahan screen me asli logic / async / test seam ho —
  har view ke saath jabardasti ViewModel nahi banega. Bade,
  determinism-critical flow ke liye TCA (The Composable
  Architecture) evaluate ho sakta hai, default nahi hai.
- State: Ek piece of state ka ek owner hoga — data down, events up.
- Networking: URLSession + async/await, ek hi API client poore app
  me (typed, contract `docs/05-api-contracts.md` se).
- Local DB: SwiftData (`@Model`, `ModelContainer`, `@Query`) —
  modern default. Core Data sirf tab jab SwiftData ki koi limit
  (jaise complex migration) saamne aaye, tab alag ADR banega.
- Settings: `@AppStorage` / UserDefaults sirf settings ke liye —
  secret kabhi UserDefaults me nahi.
- Background: BGAppRefresh / push se sync trigger, bada sync
  charging / Wi-Fi par prefer hoga.
- Testing: XCTest + Swift Testing, SwiftUI UI tests, snapshot
  tests jahan UI critical ho.

## Offline-first — iOS par wahi principle

Android wale rule ka iOS version:

- UI SwiftData local store ko observe karegi, network seedha UI
  ko data nahi dega.
- Read offline chalna chahiye, write offline queue hogi aur online
  aate hi sync hogi.
- Sync conflict ka rule backend ke saath ek hi hoga — client apna
  alag conflict rule nahi banayega.

## Mail ke liye iOS-specific

- Mail protocols: JMAP ya IMAP — Android wale decision se match
  karna hai, dono platform par alag protocol ka faisla nahi hoga.
- Push: APNs, data push se "naya mail" signal, body push me nahi.
- Widgets / Live Activities: baad me, Phase 1 ka goal nahi hai.
- Share Sheet / App Groups: app aur widget ke beech data share
  karna ho to App Groups ka secure config use hoga, UserDefaults
  share karke secret nahi bheja jayega.
- ATS (App Transport Security): HTTPS hi chalega, HTTP exception
  sirf dev me, prod me kabhi nahi.

## Security — iOS best practice (OWASP verified)

- Secrets: Keychain Services me — token, key, seed-derived material
  kabhi UserDefaults / plist me nahi.
- Keys: Secure Enclave jahan possible ho — `SecKeyCreateRandomKey`
  ke saath Secure Enclave token, key kabhi secure hardware se
  bahar nahi niklegi, sirf operation wahi hoga.
- Biometric: `LAContext.evaluatePolicy` platform method se, apna
  custom biometric UI nahi, aur fallback PIN hamesha hoga.
- App integrity: App Attest API (iOS 14+) ka evaluate public launch se pehle karna hoga (Phase 1 blocker nahi, pre-public-launch gate).
- Privacy manifest: `PrivacyInfo.xcprivacy` file me har permission ka reason,
  tracking ke liye ATT ka sahi use, bina zaroorat ke permission
  nahi mangi jayegi.
- Code: Release build me Swift compiler optimization, debug
  symbols ka sahi handling, aur secret scan har release se pehle.

## Crypto — iOS par E2EE kaise hoga

- PGP: evaluated Swift PGP library (jaise ObjectivePGP jaisi
  library, code phase me ek lock hogi) — apna PGP implementation
  kabhi nahi, aur web wale OpenPGP format se compatible hona hi
  chahiye, warna web ka mail iOS me nahi khulega.
- Private key: Keychain + Secure Enclave pattern se lock karke,
  seed kabhi plaintext store nahi hogi.
- Seed flow: web/Android jaisa hi hoga — seed dikhana, backup
  karwana, import karwana — lekin iOS par screenshot / clipboard
  risk par warning ke saath.

## Release — App Store

- Signing: Xcode automatic signing nahi, manual / CI signing ka
  plan code phase me lock hoga, certificate kabhi Git me nahi.
- Tracks: TestFlight pehle (internal, phir external), phir App
  Store — seedha App Store par nahi.
- Review: App Store Review Guidelines, privacy questionnaire,
  aur E2EE limits ka listing me saaf zikr — jhootha dawa nahi.
- Versioning: version + build number har release par badhega,
  reuse kabhi nahi.
