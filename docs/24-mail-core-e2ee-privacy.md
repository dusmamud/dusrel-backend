# Mail Core — E2EE, Privacy, Compliance, Data Lifecycle (Detailed)

Status: DRAFT — 2026-10-31
Source: Exa-verified E2EE subagent (REST connector, not MCP).
Ye doc `02-prd.md`, `06-database-design.md`, `07-security-e2ee.md`,
`13-testing-qa.md` ko replace nahi karta. Unme jo core pehle se
hai (BIP39 seed, Argon2id, OpenPGP.js Curve25519, PGP/MIME, private
key IndexedDB me, server ke paas sirf seed-encrypted backup, login-
only key directory, honest limits) yahan dobara nahi likha gaya —
yahan sirf wo lifecycle aur privacy gaps hain jo unme nahi the.

**Important caveat:** "MISSING" ka matlab hai ki scoped docs
(02/06/07/13) me nahi tha. Baaki docs (08/09/14) me kuch items
aanshik roop se ho sakte hain — naye docs likhte waqt unse cross-
check karke duplicate nahi banana hai, reference dena hai.

## Pehle se covered — dobara mat likhna

- E2EE core: browser me BIP39 seed, server ko kabhi nahi bheja jata;
  Argon2id (PBKDF2 fallback); OpenPGP.js Curve25519, PGP/MIME;
  private key browser IndexedDB me; server ke paas sirf seed-encrypted
  private-key backup jo wo decrypt nahi kar sakta.
- Key directory privacy: login-only lookup; unknown-address aur
  no-key ka jawab ek jaisa hona chahiye, taaki address probing na ho.
- Honest limits: Subject / To / From / Date PGP body encryption se
  encrypt nahi hote; E2EE mail IMAP clients me decrypt nahi hota
  (webmail only); server-side search, spam body scan, AI E2EE mail
  par kaam nahi karte; "fully encrypted" label mana hai.
- Seed loss = data loss: koi forgot-password recovery nahi, koi
  support recovery nahi; signup par checkbox/warning + seed backup
  download zaroori hai.
- Password-protected external mail: browser Argon2id + AES-GCM,
  ciphertext R2 me, link + expiry Cockroach me, password server ko
  kabhi nahi, link ki expiry aur revocation hogi.
- No-plaintext rules: password/seed/private key plaintext me kabhi
  store nahi; password hash Argon2id se; sessions/app passwords
  hash-only; R2 keys frontend ko kabhi nahi; DKIM private key Git
  me kabhi nahi; logs me mail body/key/password/token kabhi nahi.
- Storage split: metadata Cockroach me, bodies/attachments R2 blobs
  me, alag bucket per concern, per-user R2 prefix, opaque object ID,
  presigned URL sirf kam expiry ke saath.
- Tests pehle se: PGP round-trip, galat key par fail (silent plaintext
  kabhi nahi), seed recovery, seed loss, subject/headers clear hone
  ka UI disclosure, password-link sahi/galat/expiry/revoke.

## P0-1. Key rotation, expiry, revocation, compromise — lifecycle, sirf column nahi

Docs me `public_keys.revoked_at` column hai, lekin lifecycle nahi hai:

- **Key expiry:** 2 saal se kam expiry dead-man switch ki tarah
  hogi; expiry extend ho sakti hai agar user ke paas key abhi bhi hai.
- **Rotation procedure:** routine rotation vs compromised-key rotation
  ka farq hoga — compromised-key revocation backdated signatures ko
  suspect bana deta hai, routine rotation nahi.
- **Pre-generated revocation certificate:** pehle se banake rakhna
  hai, warna compromise ke waqt banane ka mauka nahi milega.
- **Revocation publish karna hai:** revocation ek published,
  machine-readable statement hai, reason ke saath. Jab tak ye widely
  publish nahi hoga (WKD/keyservers), teesre log kharab key use
  karte rahenge.
- **Directory behaviour:** revoked/expired key naye encryption ke
  liye serve nahi hogi, lekin purani mail ko decrypt karne ke liye
  retired key rakhni hogi.
Sources: Riseup OpenPGP best practices, OpenPGP CA revocation docs,
GnuPG key management manual.

## P0-2. Header / metadata protection — "subject clear hai" note policy nahi hai

Docs sahi kehte hain ki headers clear hain, lekin decision nahi
dete:

- Kaun se headers protect honge, subject ko outer envelope me
  `[...]` ki tarah chhupana hai ya nahi, Reply-To / threading /
  attachment filenames / sizes / counts metadata ke taur par kya
  honge, legacy client protected message ko kaise dikhayega.
- **RFC 9788 (Aug 2025)** ab PGP/MIME aur S/MIME ke liye header
  protection define karta hai — kaun se fields ko integrity milegi,
  kaun se ko confidentiality, aur replies me leak na ho iska signal
  kaise diya jayega. Zyadatar implementations sirf body protect
  karte hain, subject/author ko substitutable chhod dete hain.
- Naye docs me ye policy lock hogi, sirf "headers clear hain" kehna
  kaafi nahi hai.
Source: RFC 9788.

## P0-3. Reply / forward / quoting leak aur decryption-oracle attack

PRD me reply/reply-all/forward P0 stories hain, lekin E2EE mail ke
liye rule nahi tha:

- Quoted decrypted history ya to naye ciphertext ke andar fold
  hogi, ya reply/forward refuse/warn karega.
- **Attack:** attacker captured PGP ciphertext ko benign text me
  lapet kar bhejta hai, victim reply karta hai to quoted text me
  decrypted plaintext leak ho jata hai — victim decryption oracle
  ban jata hai.
- **Countermeasure:** sirf tabhi decrypt karo jab ek hi single
  encrypted part ho, mixed/attacker-wrapped content ko decrypt mat
  karo.
Source: Claws Mail users list, Feb 2019 decryption-oracle discussion.

## P0-4. Attachment E2EE scope — explicitly undecided tha

Docs "attachment send/download" kehte hain aur PGP/MIME imply karte
hain, lekin ye kabhi lock nahi hua:

- Attachments wahi PGP/MIME envelope ke andar honge (taaki filenames
  bhi protected hon), ya alag se encrypt honge?
- Attachment preview, key rotation ke baad download, bade attachment
  ka chunking, password-link attachments — in sab ka rule kya hoga?
- Preview/download code jo server cache ya plaintext temp file me
  decrypt kare, wo silently E2EE claim tod dega — ye kabhi nahi hoga.
- Ye design decision naye docs me lock hogi, P0-2 (RFC 9788) ke
  saath cross-check karke.

## P0-5. Attachment scanning vs E2EE — conflict ko decide karo, baad me discover mat karo

Scoped docs me antivirus / file-type policy hi nahi thi:

- Bahar se aane wala plaintext mail scan ho sakta hai; internal
  E2EE ciphertext ka body scan nahi ho sakta.
- Naye docs me hoga: blocked file-type list, archive handling,
  macro handling, hash-checking, quarantine vs reject, aur ye
  disclosure ki E2EE mail body scanning ko bypass karta hai.
- **Client-side scanning** browser decryption ke baad consider
  karna hai, assume nahi karna hai.
Sources: CISA attachment-scanning guidance, Canadian Centre for
Cyber Security email-security best practices, NHS email gateway
guidance.

## P0-6. Account deletion / erasure — koi flow hi nahi tha

User-initiated deletion par kya hoga, ye scoped docs me kahin nahi
tha — aur ye Phase 4 ka problem nahi hai, Phase 1 ka team user bhi
ye puchega:

- Cockroach metadata, R2 blobs, backups, public-key directory entry,
  aliases, password-links, logs — har ek ka kya hoga?
- **Jo delete nahi ho sakta:** doosre users ke mailbox me already
  deliver hua mail — recipients ki copy delete nahi ho sakti, ye
  user ko saaf batana hoga.
- Backups/versioning "delete" ko non-trivial banate hain — isliye
  P0-9 ke saath hi ye flow likhna hoga.
Sources: ICO UK GDPR right-to-erasure guidance (Article 17 — erasure
absolute nahi hai, lekin consent withdrawal / purpose poora hone
par lagta hai; backup data ko "beyond use" karna hoga agar turant
overwrite nahi ho sakta, aur user ko saaf batana hoga ki backup
data ka kya hoga).

## P0-7. Retention schedule — har category ke liye, "baad me" nahi

Scoped docs trash aur password-link lifecycle ko "baad me" par
chhodte hain, aur inki koi period nahi dete: inbox, sent, spam,
quarantine, trash, logs, DMARC reports, alias history, audit logs,
deleted-account data.

- Bina schedule ke retention default "forever" ho jata hai, jo
  privacy claim ke khilaf hai.
- **India — DPDP Act 2023:** s.8(7) — consent withdraw hone par ya
  purpose poora hone par personal data erase karo, jab tak law
  retention require na kare; s.12 — data principal ka correction
  aur erasure ka haq.
- **DPDP Rules 2025 (launch se pehle commencement status verify
  karna hai):** breach detection/investigation ke liye logs/personal
  data ka ek saal ka retention point — is ek saal ke log rule ko
  erasure ke saath explicitly reconcile karna hoga, contradiction
  chhodna nahi hai.
Sources: DPDP Act 2023, DPDP Rules 2025, DSCI retention/erasure FAQ.

## P0-8. Consent, notice, privacy-policy content, processor contracts

PRD kehta hai "basic policy Phase 1 me, full policy Phase 4 se
pehle", lekin content kabhi specify nahi hua:

- Kya personal data, kis purpose ke liye, processors kaun hain
  (CockroachDB Cloud, Cloudflare R2, VPS provider — sab ke saath
  valid processor contract chahiye), cross-border transfer / region,
  retention, user rights, grievance contact, breach notification,
  children's data.
- Processors aur regions ke bina policy, policy nahi hai.
- **DPDP Act:** s.5 notice (purpose, data, grievance mechanism;
  notice English ya Eighth Schedule languages me), s.6 consent
  (free, specific, informed, unconditional, unambiguous, sirf
  zaroori data tak limited), s.8 fiduciary duties (security
  safeguards, breach ki intimation Board aur affected principals ko,
  processor sirf valid contract par), s.13 grievance redressal,
  s.14 nomination.
- **IT (Reasonable Security Practices) Rules 2011:** personal/
  sensitive data handle karne wali body corporate ko privacy policy
  publish karni hai — practices, data types, purpose, disclosure.
Sources: DPDP Act 2023, IT Rules 2011.

## P0-9. Backup / versioning vs deletion — crypto aur schedule ka interaction

R2 versioning + Cockroach managed backups (baaki docs me noted,
scoped docs me nahi) ka matlab hai ki live systems me "delete"
karna backups me delete karna nahi hai:

- Backup retention period kya hogi?
- Backups ke liye "beyond use" rule kya hoga?
- Versioned-object deletion kaise hogi (delete markers vs permanent
  delete)?
- Kya per-message/per-user key wrapping use hogi, taaki key deletion
  se purana ciphertext unusable ho jaye?
- Bina iske P0-6 ko honestly implement nahi kar sakte.
Source: ICO right-to-erasure guidance (backup "beyond use" rule).

## P0-10. Multi-device aur lost-device handling

Seed-encrypted backup Cockroach me hai, lekin ye nahi hai:

- Use kaun fetch kar sakta hai (auth + 2FA gating, rate limiting)?
- Key rotation par purana backup dobara encrypt hoga ya invalid
  hoga?
- Device deprovisioning: sessions/app passwords revoke karne se
  lost device par pehle se maujood private key nahi hat ti.
- **Disclosure:** unlocked key wale lost device se purani E2EE mail
  tab tak padhi ja sakti hai jab tak rotation na ho. Ye Day-1
  security doc me hoga, lost phone ke baad discover nahi hoga.
- Ye seedha P0-1 (revocation) aur docs ke apne threat model
  ("device compromise = no protection") se follow hota hai.

## P0-11. Key-directory integrity aur key-change warnings

Docs internal directory par trust karte hain, lekin directory
poisoning / substitution se protection nahi dete:

- Directory compromise ho to attacker recipient ki public key badal
  kar future mail padh sakta hai.
- Naye docs me hoga: signed directory entries ya audit/transparency
  log, fingerprint verification (out-of-band check), aur sensitive
  mail bhejne se pehle visible "recipient key changed" warning.
- **WKD / Autocrypt / external-key discovery ka decision bhi hoga:**
  abhi internal-directory-only hai, jo external PGP users ko limit
  karta hai — ye stated hona chahiye, implied nahi.
- Revocation ko widely publish karna padta hai (WKD/keyservers),
  wahi publication problem key changes par bhi lagti hai.

## P0-12. Alias lifecycle privacy

Docs alias creation aur catch-all OFF cover karte hain, lekin ye
nahi:

- **Deleted aliases kabhi dobara kisi aur user ko nahi milenge**
  (recycle nahi honge) — purane alias par aaya mail stranger ko
  leak ho jayega agar recycle hua.
- Alias delete ke baad alias-to-real-address mapping kitni der
  rahegi?
- Alias delete hone ka us alias par pehle se bheje gaye mail par
  kya asar hoga?
- Ye Day-1 privacy bug hai agar aliases recyclable hain.

## P0-13. Password-link hardening aur post-expiry deletion

`max_views` hai, lekin scoped docs me ye nahi hai:

- Link-password guesses par brute-force rate limiting.
- Link-access logging, bina content leak kiye.
- Enumeration protection: link ID guess karne par ye reveal nahi
  hona chahiye ki link exist karta hai ya nahi.
- **Expiry/revocation ke baad R2 object delete hoga** — sirf metadata
  ko revoked mark karke ciphertext R2 me hamesha ke liye chhodna
  nahi hoga.

## P0-14. Client-side plaintext leakage — cache, snippets, notifications, drafts

Docs draft autosave ko plaintext flag karte hain, lekin remediation
decision nahi dete. Iske saath ye bhi missing tha:

- Browser cache / service-worker cache / IndexedDB plaintext.
- Search snippets aur previews.
- Push notifications (body ya sensitive subject kabhi nahi hoga).
- HTML remote-content tracking pixels (remote images read/IP leak
  kar sakte hain).
- **Rule:** E2EE mail sirf memory/tab me decrypt hoga, plaintext
  kabhi persist nahi hoga, notifications/snippets me plaintext
  kabhi nahi aayega, remote content by default disable hoga.

## P0-15. Lawful disclosure / legal-hold tension — over-promise mat karo

Docs kehte hain "server E2EE mail decrypt nahi kar sakta", lekin
ye kabhi nahi kehte ki lawfully compel hone par Dusrel kya de
sakta hai:

- **De sakta hai:** metadata, logs, non-E2EE mail, password-link
  metadata, account/alias records.
- **Technically nahi de sakta:** E2EE body, bina user ki key ke.
- Disclosure policy me ye farq likha hoga, aur "no-logs" ya
  "absolute anonymity" ka dawa nahi hoga agar logs ek saal tak
  retain hote hain (P0-7 dekho).
- **Note:** Indian IT Act / intermediary aur DPDP obligations ko
  launch se pehle legal counsel se check karwana hai — ye research
  legal advice nahi hai.

## P1 — Abhi design karo, Phase 2/3 me ship kar sakte ho, lekin design me corner mat karo

- **P1-1. Subkey model:** signing vs encryption subkeys alag hon,
  taaki encryption key rotate ho sake bina user ki identity/signing
  key badle; expiry reminders hon (Riseup best practice — expiry
  extendable hai).
- **P1-2. Data export / portability:** user export (mbox/EML) E2EE
  ko sahi handle karega — ciphertext + keys alag se, warnings ke
  saath, kabhi default me decrypted mail ko unprotected file me
  export nahi karega; import E2EE mail ko silently plaintext me
  downgrade nahi karega.
- **P1-3. Spam/quarantine retention:** quarantine period, false-
  positive release, quarantine deletion — warna quarantine doosre
  logon ke mail ka indefinite retention ban jayega.
- **P1-4. Region / data-residency pinning:** Cockroach single region
  aur R2 jurisdiction privacy policy me naam ke saath honge;
  "single region" bina region ka naam liye residency statement
  nahi hai.
- **P1-5. Phishing display rules (SPF/DKIM/DMARC se aage):**
  display-name spoofing, homograph/lookalike domains, link-hover /
  link-rewriting warnings, external-image blocking — Stalwart ki
  built-in phishing protection (baaki docs me noted) ko mail-core
  policy se jodna hoga, kyunki E2EE mail par body scanning help
  nahi kar sakti.
- **P1-6. Account recovery bina E2EE tode:** abhi decide karo ki
  koi non-seed recovery path hoga ya kabhi nahi (jaise trusted-
  device approval, social recovery) — agar nahi to permanent keh do;
  agar haan to launch se pehle design karo, kyunki baad me add
  karne par key escrow chahiye hoga aur current promise toot jayega.
