# Security & E2EE — Atomic-style privacy, honest limits ke saath

Status: DRAFT — 2026-10-31
Ye doc sabse important hai. Iske bina E2EE ka dawa mat karna.

## Threat model — kis se bacha rahe hain, kis se nahi

Bacha rahe hain:

- Server operator / database leak / R2 leak se: E2EE mail ki body
  ciphertext hi milegi, plaintext nahi.
- Network sniffing se: TLS 1.3 har jagah.
- Dusre user se: ek user dusre ka mailbox, key ya file nahi dekh
  sakta — auth + per-user prefix + row-level checks se.

Nahi bacha rahe hain (aur ye chhupana nahi hai):

- User ka device compromise ho to kuch nahi bacha sakta — browser me
  key unlock hone ke baad plaintext device par hi hota hai.
- Metadata se: kaun kisko, kab, kitna bada mail bhej raha hai — ye
  traffic analysis se chhupta nahi hai.
- User khud apna seed kisi ko de de to koi system nahi bacha sakta.

## Key system — step by step

1. **Seed phrase:** browser me BIP39 se 12/24 words bante hain.
   Seed kabhi server ko nahi bheji jati, kabhi log nahi hoti.
2. **Key derivation:** seed se Argon2id se key derive hoti hai
   (fallback PBKDF2, browser support ke hisaab se).
3. **Keypair:** OpenPGP.js, Curve25519, PGP/MIME format — Proton /
   Thunderbird / gpg se compatible standard, apna custom format nahi.
4. **Private key storage:** browser IndexedDB me, seed-derived key se
   locked. Server par sirf seed-encrypted backup copy ho sakti hai,
   jise server decrypt nahi kar sakta.
5. **Public key directory:** Cockroach me, login-only lookup. Public
   endpoint nahi hoga, warna koi bhi ye probe kar sakega ki kaun sa
   address live hai. Unknown address aur no-key ka jawab ek jaisa
   hoga.
6. **Send (internal):** browser recipient ki public key se encrypt
   karta hai, ciphertext server ko milta hai.
7. **Read:** browser apni private key se decrypt karta hai, plaintext
   sirf us tab me rehta hai.

## Password-protected external mail

- Browser me password se derived key (Argon2id + AES-GCM) se body
  encrypt hoti hai.
- Ciphertext R2 me, link + expiry Cockroach me.
- Password kisi bhi channel se server ko nahi bheja jata. Password
  share karne ka channel user ka hai (alag message/call) — product
  me ye saaf likhna hai.
- Link expiry aur revoke zaroori hai; bina expiry ke link nahi banega.

## Normal mail vs E2EE mail — farq saaf rakhna hai

| Cheez | Normal mail | E2EE mail |
|---|---|---|
| Body server par | Plaintext (TLS ke baad) | Ciphertext only |
| Server search | Poora search chalega | Sirf metadata / client search |
| Spam body scan | Chalega | Body par nahi chalega |
| IMAP apps me | Chalega | Decrypt nahi hoga, sirf webmail me |
| Subject / To / From / Date | Clear | Clear hi rahega (PGP body ko cover karta hai) |
| Draft autosave | Plaintext | Plaintext rahega jab tak draft encryption alag se na ban jaye |

UI me har E2EE mail par ye saaf dikhna chahiye ki kya encrypt hai
aur kya nahi. "Fully encrypted" jaisa jhootha label kabhi nahi.

## Seed loss = data loss

- Seed phrase bhool gaye to E2EE mail hamesha ke liye gaya.
- Iska koi "forgot password" workaround nahi hai, aur support bhi
  recover nahi kar sakta.
- Signup ke time ye checkbox + warning ke saath dikhana hai, aur
  seed backup download karwana hai, bina iske account aage nahi
  badhega.
- Seed ko screenshot lene se rokna possible nahi hai — user ko ye
  bhi batana hai ki seed ko safe jagah likh kar rakhe, phone ke
  notes me nahi.

## Server-side security checklist

- [ ] Argon2id password hashing, kabhi plain / MD5 / SHA1 nahi
- [ ] TOTP 2FA, app passwords hash only
- [ ] Rate limit: login, send, link create
- [ ] CSP, HSTS, secure cookies (frontend + API dono par)
- [ ] Zod validation har endpoint par
- [ ] Logs me body / key / password / token nahi
- [ ] Dependency audit, Docker image scan (code phase me)
- [ ] DKIM private key sirf mail server par, Git me kabhi nahi
- [ ] R2 keys sirf backend env me, frontend ko kabhi nahi
