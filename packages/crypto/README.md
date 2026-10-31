# packages/crypto — shared E2EE helpers (code, Phase 3 slice)

BIP39 seed helpers, Argon2id key derivation, AES-GCM helpers aur
OpenPGP.js Curve25519 helpers — jo mail ke E2EE me (aur baad me
shared crypto ke taur par) ek jaisa use hoga.

## Functions (sirf yehi scope hai, isse zyada nahi)

- **BIP39:** `generateMnemonic(128 | 256)` -> 12/24 words;
  `mnemonicToSeed(mnemonic)` -> deterministic 64-byte seed.
  Galat mnemonic par throw hota hai, khaali seed kabhi nahi.
- **Argon2id:** `deriveKeyArgon2id(input, salt, hashLength = 32)` ->
  raw key Buffer. Params auth package wale hi hain (OWASP: 19 MiB,
  2 iterations, 1 lane). Salt kam se kam 8 bytes ka hona chahiye,
  har key ke liye alag random salt banao (salt secret nahi hota).
- **AES-256-GCM (Node WebCrypto):** `aesGcmEncrypt(key, text)` ->
  `{iv, ciphertext}` dono base64; IV har baar naya random 12 bytes
  ka hota hai. `aesGcmDecrypt(key, box)` galat key ya tampered
  data par throw karta hai (GCM auth tag verify hota hai). Key
  32 bytes ki honi chahiye.
- **OpenPGP Curve25519:** `generatePgpKeypair({name, email})` ->
  `{privateKeyArmored, publicKeyArmored, fingerprint, keyVersion}`;
  `pgpEncryptString(publicKeyArmored, text)` ->
  armored message; `pgpDecryptString(privateKeyArmored, armored)` ->
  text; `pgpFingerprintFromPublicKey(publicKeyArmored)` ->
  `{fingerprint, keyVersion}`.

## Deps (npm view se latest stable, 31 Oct 2026 ko verify kiye gaye)

- `argon2@^0.45.1` (auth package me bhi yahi version hai)
- `bip39@^3.1.2`
- `openpgp@^6.3.2`
- Dev: `@types/node@^24.19.0`, `typescript@^7.0.0` (baaki
  packages wale hi versions)

Teeno deps apne types khud ship karte hain (koi `@types/*`
extra nahi chahiye). openpgp 6.3.2 dual package hai (ESM +
CJS) — repo ka tsc CommonJS emit karta hai, aur openpgp ka
`require` export CJS build deta hai, isliye import me koi
interop problem nahi honi chahiye (coordinator ke build par
confirm hoga).

## Key version + fingerprint (COORDINATOR KE LIYE ZAROORI)

- openpgp 6.x default **v6 keys (RFC 9580)** banata hai.
  v6 fingerprint **SHA-256 = 64 hex chars** hota hai.
  v4 fingerprint SHA-1 = 40 hex chars hota hai.
- **MISMATCH (report kiya gaya hai, yahan fix nahi kiya gaya
  hai):** mail-api ka `publishKeySchema` fingerprint ke liye
  sirf **40 hex chars** mangta hai. Is package ki v6 key ka
  fingerprint (64 hex) wahan 400 fail hoga. Is package me isko
  chhupane ke liye koi truncation ya v4 downgrade nahi kiya
  gaya hai, kyunki v6 hi current standard hai. Faisla
  coordinator ka hai: ya to schema ko 40-or-64 hex tak badhana
  hoga, ya versioned fingerprint format lana hoga. Mail-api,
  auth-api, api-contracts ko is worker ne haath nahi lagaya hai.

## Nahi karega

- Apna custom encryption format banana, private key ya seed ko
  server par bhejna, key ko log karna.
- Private key ko bina passphrase/encryption ke store karna —
  private key ko caller ko turant encrypt karke store karna
  chahiye (jaise AES-GCM se, seed-derived key se).

## Test chalane ka note (coordinator ke liye)

Package ka build tsconfig sirf `src` compile karta hai (spec ke
hisaab se, baaki packages ke template jaisa). Isliye
`test/crypto.test.ts` package build se compile nahi hogi —
test chalane ke liye coordinator ko tsconfig me `test`
include karna hoga (service packages ki tarah) ya test ko
alag se compile karna hoga. Test me koi real key/seed
hardcode nahi hai; PGP keypair runtime par generate hota hai.
