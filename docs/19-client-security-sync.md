# Client Security & Sync — Android, iOS, Desktop ke liye ek rulebook

Status: DRAFT — 2026-10-31
Exa verified: OWASP Mobile Application Security Cheat Sheet.

## Golden rules — teenon client par lagu

1. **Client par bharosa mat karo.** Permission, validation aur
   business rule ka asli check server par hoga. Client ka check
   sirf UX ke liye hai.
2. **Password device par store mat karo.** Device par sirf
   revoke karne layak token rahega, password kabhi nahi.
3. **Sensitive data encrypt karke, platform key se lock karke
   rakho.** Password se key banani ho to dedicated KDF (Argon2id
   jaisa) + unique salt + sahi work factor ke saath — fast hash
   ko key mat banao.
4. **Device ID se auth mat karo.** Device ID spoof ho sakta hai,
   wo auth ka proof nahi hai.
5. **Logs me secret nahi.** Token, key, seed, password, mail body
   — kisi bhi client log me nahi aayega, debug build me bhi nahi
   (debug log ka alag rule banega, prod me to bilkul nahi).

## Secure storage matrix

| Cheez | Android | iOS | Desktop (Tauri) |
|---|---|---|---|
| Token | EncryptedSharedPreferences + Keystore | Keychain | OS Keychain |
| Private key material | Keystore (StrongBox jahan mile) | Keychain + Secure Enclave | OS Keychain |
| Seed-derived key | Keystore-wrapped, seed plaintext kabhi nahi | Keychain-wrapped, seed plaintext kabhi nahi | OS Keychain-wrapped |
| Settings (non-secret) | DataStore / Preferences | UserDefaults / AppStorage | Tauri store / local file |
| Mail/file cache | Room + EncryptedFile (sensitive) | SwiftData + Data Protection | Encrypted local cache |

## Biometric + fallback

- Har client me platform biometric use hoga: Android
  BiometricPrompt, iOS LAContext, Desktop OS hello/keychain unlock.
- Biometric ke saath hamesha fallback hoga: PIN / password.
  Biometric fail ho to user lockout nahi hoga, fallback se khulna
  chahiye.
- Biometric data kabhi app ko nahi milta — ye platform hi handle
  karta hai, app sirf "authenticated ya nahi" jaanti hai.

## Sync & conflict — ek rule, teen client

- Source of truth: server (Cockroach metadata + R2 blobs) + local
  cache ka combination — local UI ka source hai, server final
  sach hai.
- Conflict rule ek hi hoga, har client me wahi:
  - Mail folder move / read-unread: last-write-wins ya server
    timestamp — code phase me ek lock hoga, teen client alag rule
    nahi banayenge.
  - Draft: device-local draft sync ka rule alag se lock hoga,
    warna do device par draft overwrite ho jayega.
- Sync trigger: app open, push signal, background refresh (OS
  limits ke andar), manual pull-to-refresh — har trigger par poora
  sync nahi, delta sync hoga.
- Offline write: queue me jayega, online aate hi WorkManager /
  BGTask / Tauri background task se sync hoga, exponential
  backoff ke saath.

## Crypto sync — seed aur key teen device par kaise milegi

- Seed ek device se dusre par **kabhi server ke through plaintext
  me nahi jayegi**.
- Naya device: user seed phrase dalega (ya QR / file import, jo
  design lock hoga) — usi se wahi keypair dobara derive hoga.
- Ek device par key rotate hui to purane E2EE mail ka kya hoga,
  ye rule web wale E2EE doc ke saath match karna hai — rotate
  karne par purani key ka backup rakhna hoga, warna purana mail
  nahi khulega.
- Koi client dusre client ki private key ko server se "sync"
  karke nahi lega — ye escrow ban jayega, aur E2EE ka dawa toot
  jayega.

## App integrity & tamper (baad me, abuse badhe tab)

- Android: Play Integrity API evaluate karna.
- iOS: App Attest API evaluate karna.
- Desktop: Code signing + updater signature verify karna.
- Ye teeno Phase 1 ke must-have nahi hain, lekin abuse badhe to
  inke bina public launch risky hoga — isliye docs me pehle se
  likha hai.

## Release checklist — har client, har release

- [ ] Secret scan pass (Git + build)
- [ ] Permissions ka reason UI + store listing me saaf hai
- [ ] E2EE limits ka zikr listing me hai, jhootha dawa nahi hai
- [ ] Version/build number badha hai, reuse nahi hua hai
- [ ] TestFlight / Internal track pehle, phir public
- [ ] Rollback plan hai — kharab release par purana version wapas
  kaise aayega, ye pehle se likha hai
