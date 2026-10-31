# Account Signup + Recovery Flows — A to Z

Status: DRAFT — 2026-10-31
Source: Exa-verified best-practice report (2026-10-31, Exa Search API
route se — REST connector, MCP server nahi) + maujooda docs.
Sources: OWASP Forgot Password Cheat Sheet, OWASP WSTG (password reset
testing), OWASP Email Validation Cheat Sheet, OWASP Bot Management
Cheat Sheet, Cloudflare Turnstile docs, Proton account recovery page,
Trezor/KeepKey seed backup guides.

Ye doc `docs/21-mail-core-user-flows.md` ko replace nahi karta, usko
extend karta hai. `docs/21` me F1 (admin invite), F4 (forgot, normal
account), F5 (2FA recovery), F16 (admin flows) pehle se hain — yahan
unko dobara poora nahi likha gaya hai, sirf unke gaps bhare gaye hain:
public signup ka step-by-step flow, mail-account wali chicken-egg
problem, secondary recovery email, admin reset, signed-in reset, seed
restore, aur non-seed recovery ka decision. Jo flow yahan bhi nahi hai,
wo abhi bhi missing mana jayega.

**Numbers ka note — galat mat samajhna:** Is doc me diye numbers
(reset token expiry 1 ghanta, token kam se kam 128 bits, signup velocity
3/hour ka example) starting proposals hain, final locks nahi. Ye numbers
sources se liye gaye hain, code phase se pehle inko lock karna hoga.
Jahan decision open hai, wahan saaf `OPEN` likha hai.

## 0. Phase map — kaun sa flow kab milega

| Phase | Signup / account kaise banega |
|---|---|
| Phase 1 | Public signup nahi. Sirf admin (Owner) user banata hai — `docs/21` F1, ADR-009. |
| Phase 2 | Mail polish — aliases, 2FA, app passwords (`docs/21` F5, F6). |
| Phase 3 | Full E2EE — seed phrase, PGP round-trip, password-protected external mail. Seed restore isi phase ka flow hai. |
| Phase 4 | Public signup — sirf tab jab abuse control, captcha, rate limits, terms/privacy/support taiyaar hon. Isse pehle public signup ka koi announcement nahi hoga. |

## 0.1 Password reset vs data recovery — ye dono alag hain

Ye fark poore doc ki jaan hai, aur sabse zyada galat samjha jata hai:

| Recovery method | Login password reset? | E2EE data dobara khulega? |
|---|---|---|
| Seed / recovery phrase (BIP39) | Haan | Haan |
| Secondary email / phone se reset | Haan | Nahi — sirf login wapas milega, purana E2EE mail nahi khulega (jab tak purana password yaad na ho) |
| Signed-in reset (doosre device par active session se) | Haan | Haan (kyunki data pehle se unlocked session me hai, isliye lock hone se bach jata hai) |
| Device backup / recovery file (encrypted keychain) | Nahi | Haan — isko password-reset method ke saath milana padega |
| Trusted contacts se data recovery | Nahi | Haan — isko bhi password-reset method ke saath milana padega |

Proton ki salah (best practice): kam se kam recovery phrase + ek
password-reset method + ek data-recovery method — teeno alag. Sirf ek
method rakhna matlab ek scenario me pakka lockout hai.

**Dusrel ke liye OPEN decision (code se pehle lock karna hai):**
Ya to ye layered model apnao, ya permanent likh do ki "non-seed
recovery kabhi nahi hogi". Beech ka rasta sabse khatarnaak hai —
user umeed rakhega aur milega kuch nahi. Ye decision `docs/24`
P1-6 par bhi open hai, wahan se ye doc usko repeat karta hai, close
nahi karta.

## 1. Phase 1 — Admin invite flow (F1 ka summary + naya rule)

`docs/21` F1: Admin user banata hai, mailbox + quota set karta hai,
user ko first-login invite milta hai, user pehli baar login karke apna
password set karta hai, naam + primary address confirm karta hai.
Invite single-use hai, expiry kam hai (number code phase me lock hoga),
expiry ke baad admin ko naya invite bhejna padega, purana kaam nahi
karega.

**Naya DRAFT rule (is doc se):** Pehli login par user ko secondary
recovery email set karne ko kaha jayega, aur saaf warning dikhayi
jayegi: "Bina secondary recovery email ke, password bhoolne par tum
apne mail account ka reset link nahi paa sakoge — kyunki reset link
usi mailbox me jayega jisme tum login hi nahi kar sakoge (Section 2
dekho)." User is step ko skip kar sake, lekin skip karne par warning
dobara settings me dikhti rahegi jab tak recovery email verify na ho.

## 2. Secondary recovery email — chicken-egg problem ka hal

**Problem:** Normal site par forgot password ka link user ke email par
jata hai aur kaam kar jata hai, kyunki wo email kisi aur provider ka
hota hai. Dusrel mail account par ye ulta hai: agar user apne Dusrel
mail ka password bhool gaya, to reset link usi mailbox me jayega
jisme wo login hi nahi kar sakta. Isliye `docs/21` F4 ka "reset token
email se jata hai" adhoora tha — kis email par, ye likha hi nahi tha.

**DRAFT rule:**

1. Secondary recovery email hamesha Dusrel address se alag, doosre
   provider ka hona chahiye. Best practice: recovery ke liye alag,
   kam use hone wala account rakho — kyunki ek account compromise hua
   to usse doosra bhi khul sakta hai (circular dependency).
2. Secondary email settings me, logged-in haalat me set hoti hai, aur
   verify honi chahiye: verification link/code us secondary address
   par jayega, single-use, time-limited. Verify hone tak recovery
   email active nahi mani jayegi.
3. Secondary email badalne par dobara existing factor se
   re-authenticate karna padega, purani aur nayi dono addresses par
   notification jayegi.
4. Forgot password ka reset link sirf verified secondary email par
   jayega — kabhi bhi usi Dusrel mailbox par nahi, jab user usme
   logged-out hai. Agar secondary email set/verify nahi hai, to
   self-service forgot kaam nahi karega — tab sirf Section 5 (admin
   reset) ya Section 4 (signed-in reset) bachta hai, aur user ko ye
   baat saaf dikhani hai, "link bhej diya" ka jhootha message nahi.
5. Secondary email se sirf login password reset hota hai, E2EE data
   nahi khulta (Section 0.1 dekho). Ye baat reset flow me user ko
   saaf dikhani hai.

## 3. Forgot password — detailed (F4 ko extend karta hai)

`docs/21` F4 ke steps (same message, single-use token, no auto-login,
sessions invalidate, notification) is doc me bhi lagu hain. Unke upar
ye specs add hoti hain (OWASP Forgot Password Cheat Sheet + WSTG):

1. **Enumeration nahi:** Hamesha ek jaisa message + uniform response
   time, chahe account ho ya na ho. Timing difference se bhi account
   ka pata nahi chalna chahiye — isliye dono case me wahi logic chalega,
   quick exit nahi.
2. **Token specs (starting proposals, lock nahi):** Token CSPRNG se
   bana ho, kam se kam 128 bits (32 hex characters). Database me
   token **hashed** store ho, plaintext me kabhi nahi — warna DB leak
   hua to attacker token reuse karke password reset kar lega. Token
   kabhi known value se nahi banega (jaise email ka MD5) aur insecure
   GUID se nahi banega.
3. **Expiry + single-use:** Token single-use hai, use hone par ya
   expiry par invalidate ho jayega. Expiry starting proposal: 1 ghanta
   se zyada nahi (WSTG: rarely more than an hour). Reset link sirf
   HTTPS par khulega, aur reset page par third-party resources nahi
   hone chahiye taaki token `Referer` header se leak na ho
   (`Referrer-Policy` set karo).
4. **Reset ke baad:** Naya password do baar likhwana, secure password
   policy poore app jaisi hi ho, password secure tareeke se store ho.
   Reset ke baad auto-login nahi — user normal login se andar aayega.
   Saare existing sessions invalidate hon (ya user se poochha jaye),
   aur user ko notification email jaye — **us email me password kabhi
   nahi hoga.**
5. **Rate limit + bot protection:** Per-account rate limit + CAPTCHA
   (Turnstile) reset endpoint par, warna attacker ek account ke liye
   hazaron reset requests bhej kar user ka inbox flood kar dega.
   Sirf reset request par account lock nahi hoga — warna attacker
   kisi ko bhi lock kar dega.
6. **MFA bypass nahi:** Reset process normal login se kamzor nahi hona
   chahiye aur MFA requirement ko bypass nahi karna chahiye. Reset ke
   baad 2FA factor wahi rahega, jab tak user alag se F5 recovery se
   usko change na kare.
7. **Kabhi nahi:** User ka maujooda (purana) password kabhi email par
   mat bhejo — agar system purana password bhej sakta hai, to iska
   matlab password reversible ya plaintext me store hai, jo serious
   weakness hai. Naya password email par bhejna bhi preferred model
   nahi hai (WSTG: wo unencrypted jata hai, inbox me pada reh sakta
   hai) — isliye reset link model hi default hai, Section 5 me bhi.

## 4. Signed-in reset — doosre device par active session ho to

Proton ka model, Dusrel ke liye DRAFT rule:

1. Agar user kisi doosre device/app par abhi bhi signed-in hai, to
   wahan se wo apna login password reset kar sakta hai, bina
   secondary email ke.
2. Ye sirf active, verified session se hoga — naye device par bina
   login ke ye rasta nahi khulega. Isliye ye kabhi eklauta recovery
   method nahi hona chahiye, backup method bhi chahiye.
3. Signed-in reset ke baad bhi saare doosre sessions ka review dikhao,
   user chahe to sab revoke kare, aur notification jaye.
4. E2EE data is rasta se bachta hai, kyunki session me data pehle se
   unlocked hai — isliye ye Section 0.1 table me "dono" wali row me
   aata hai. Ye fark user ko reset screen par saaf dikhana hai.

## 5. Admin reset — locked-out user ke liye (Phase 1 team/private)

`docs/21` F16 me admin user banata/disable/delete karta hai likha hai,
lekin "user locked out ho to admin uska password kaise reset karega"
step-by-step nahi tha. Ye section wo gap bharta hai:

1. User admin/owner se sampark karta hai (support channel se, jo
   Phase 4 se pehle team/private setup me decide hoga — channel ka
   naam is doc me lock nahi hai).
2. Admin user ki pehchaan verify karta hai (team/private setup ke
   hisaab se — jo tareeka hoga, wo audit log me likha jayega; bina
   verification ke reset nahi hoga).
3. Admin single-use, expiry wala reset link jaari karta hai, jo user
   ki verified secondary email par jayega. Secondary email bhi nahi
   hai to admin verified channel par link dega, aur ye exception audit
   log me darj hogi.
4. **Admin kabhi ye nahi karega:** User ka purana password nahi
   bhejega, user ka mail body nahi dekhega, user ki private key nahi
   dekhega, aur bina audit ke koi reset nahi karega. Har admin reset
   audit log me aayega — kisne, kab, kis account ka — bina mail body
   ke (ye rule `docs/21` F16 me pehle se hai, yahan repeat hai taaki
   reset flow me bhoola na jaye).
5. Reset link se user naya password set karega, phir normal login —
   auto-login nahi. Saare sessions invalidate honge, user ko
   notification jayegi.
6. **Temporary password sirf aakhri option hai, default nahi:** Agar
   link dena mumkin nahi hai aur temporary password dena hi pade, to
   wo CSPRNG se bana ho, pehli login par force change mandatory ho,
   aur wo password inbox me pada na rahe — user ko pehli login par
   hi badalna hoga. Ye model kamzor hai (password unencrypted jata
   hai), isliye isko default mat banao.
7. **E2EE boundary — reset screen par saaf likhna hai:** Admin reset
   sirf login password badalta hai. E2EE private key ke liye phir bhi
   seed ya purana password chahiye. Agar user ne seed bhi kho diya,
   to admin reset ke baad bhi E2EE mail nahi khulega. User ko ye
   baat reset se pehle dikhani hai, baad me nahi.

## 6. 2FA recovery — jab backup code bhi na ho

`docs/21` F5: Setup ke waqt single-use backup codes milte hain, phone
kho gaya to backup code se login, naya authenticator enroll, purana
factor revoke + notification. Uske aage:

1. Agar backup codes bhi kho gaye aur phone bhi nahi hai, to
   self-service 2FA recovery khatam hai — tab sirf Section 5 (admin
   reset + pehchaan verification) bachta hai, aur uske baad bhi 2FA
   factor dobara enroll karna padega.
2. 2FA factor change ke liye sirf active session kaafi nahi — dobara
   existing factor se re-authenticate karna padega (F5 me pehle se
   hai), aur change par out-of-band notification jayegi.
3. E2EE boundary yahan bhi lagu hai: 2FA reset hone se E2EE key
   wapas nahi milti — uske liye Section 8 (seed restore) chahiye.

## 7. Phase 4 — Public signup, step-by-step

Ye flow Phase 1 me nahi chalega. Ye sirf tab chalega jab abuse
control, captcha, rate limits, terms/privacy/support taiyaar hon
(ADR-009, roadmap Phase 4).

1. **Address chuno:** User apna chahiye hua address (local-part)
   dalta hai. Availability check hoga — availability dikhana
   zaroori hai, warna user address chun hi nahi payega. Isliye
   availability endpoint ko rate limit se bandhna hoga, warna
   attacker poori list enumerate kar lega.
2. **Reserved names kabhi mat do:** `postmaster`, `abuse`, `support`,
   `admin`, `security` jaise system addresses, aur pehle se use hui
   addresses, kabhi naye user ko mat do. Deleted address kabhi
   recycle mat karo — purane user ka mail naye user ko nahi jana
   chahiye (ye rule aliases ke liye `docs/24` me pehle se hai,
   signup par bhi wahi lagu hai).
3. **Password + terms:** Strong password policy (poore app jaisi),
   weak/compromised password reject hoga (`docs/25` checklist item).
   Terms + privacy policy accept karni hogi, acceptance ka timestamp
   store hoga.
4. **Bot check — Turnstile Managed + server-side Siteverify:**
   Client widget akele kaafi nahi hai, kyunki attacker form ko bypass
   karke seedha endpoint par POST kar sakta hai. Isliye har signup
   submission se pehle server Siteverify API se token validate
   karega, token ek hi baar chalega. Turnstile ka ye rule `docs/22`
   ke bot section se match karta hai.
5. **Velocity + abuse limits (starting proposals, lock nahi):**
   Per-IP, per-ASN, per-device-fingerprint signup velocity limit —
   OWASP example 3/hour. Per-endpoint rate limit alag se, aur login
   endpoint par do alag buckets (per-username + per-IP, combined
   nahi — combined bucket credential stuffing nahi rokta, ye
   `docs/22` ke login rate-limit rule se match karta hai). Limit
   lagne par generic `429` jawab, bucket ka detail attacker ko mat
   batao.
6. **Disposable / risky signup:** Known disposable domains ki list
   rakho, weekly refresh karo. Sirf strict block mat karo — risk-based
   control behtar hai. High-entropy local-part + abhi-abhi bana
   domain wale signup reject karo (OWASP Bot Management Cheat Sheet).
7. **Email ownership verification gate:** Account banne ke baad bhi
   features tab tak gate rahenge jab tak user apni Dusrel address ki
   ownership verify na kare. Verification ka tareeka Phase 4 design
   me lock hoga (is doc me lock nahi hai) — lekin principle ye hai:
   verification se pehle account usable nahi, sirf confirmation
   bhejna kaafi nahi hai. Verification token single-use,
   time-limited, CSPRNG se bana ho.
8. **Signup ke waqt E2EE warning (Phase 3 ke baad):** Jab E2EE on
   hoga, to signup par ye saaf dikhana hai: seed bhoolne par recovery
   nahi, subject/headers encrypt nahi hote (`docs/02` me pehle se
   hai). Ye warning checkbox ke saath hogi, sirf chhote text me nahi.

## 8. Seed creation + backup verification (Phase 3, E2EE)

`docs/07` me seed BIP39 se 12/24 words browser me bante hain, server
ko kabhi nahi bheje jate. Creation ka step-by-step flow ye hai:

1. E2EE onboarding par browser me BIP39 seed (12/24 words, 2048
   words ki list se, exact order me) generate hoga. Seed se hi
   private key derive hoti hai — ek word galat ya order badla to
   alag key banegi.
2. User ko Recovery Kit milega — seed ko download, print ya paper
   par likhne ka rasta, Proton ke model jaisa. Recovery Kit creation
   ke waqt hi milega, baad me "kabhi de denge" nahi.
3. **Backup verification creation ke waqt hi mandatory hai:**
   User se seed words dobara enter karwao, ya random positions ke
   words poochho, tabhi aage badhne do. Trezor/KeepKey ki salah:
   "Untested backup is a piece of paper you only believe is a
   backup." Aam galtiyan: do words swap ho jana, spelling galat
   (jaise `flat` vs `float`), haath ki likhai na padh paana — ye
   sab saalon baad tab pata chalta hai jab backup chahiye hota hai.
4. **Seed kabhi nahi:** Seed server ko mat bhejo, screenshot mat lo,
   email/cloud/photo me copy mat rakho, chat me mat bhejo, log me
   mat likho. Seed entry wali screen par autocomplete band ho, aur
   use ke baad memory se seed clear ho jaye. Support bhi kabhi seed
   nahi mangega — ye baat user ko onboarding me saaf batao.
5. Seed kho gaya to data loss hai, koi forgot-password workaround
   nahi hai, support bhi recover nahi kar sakta (`docs/07`,
   `docs/24` me pehle se hai). Ye warning signup/E2EE onboarding
   par checkbox + warning ke saath hogi.

## 9. Seed restore — naye device par, step-by-step (Phase 3)

1. Naye device par user "Restore with seed phrase" chunta hai.
2. Seed words exact order me dalta hai — order galat hua to alag key
   banegi, isliye step 4 ka fingerprint check zaroori hai, sirf
   "words daal diye" kaafi nahi hai.
3. Seed browser/device me hi rahega, server ko kabhi nahi jayega.
   Usi seed se wahi private key derive hogi jo pehle thi.
4. **Fingerprint check:** Derived public key ka fingerprint key
   directory me maujood fingerprint se milao. Match nahi hua to
   saaf error dikhao — "seed galat hai ya order galat hai" — aur
   aage mat badho. Bina is check ke galat seed chupchaap galat key
   bana dega aur user ko lagega restore ho gaya.
5. Match hone par decrypt test dikhao (ek purana E2EE mail ya test
   message khol kar), tabhi restore complete mano.
6. Restore ke baad seed entry wali memory clear ho, aur user ko
   dobara backup verify karne ko kaho (agar uska paper backup
   galat nikla to abhi pata chal jayega, baad me nahi).
7. **Seed restore login password reset nahi hai:** Agar user login
   password bhi bhool gaya hai, to uske liye Section 3/5 ka rasta
   alag se chahiye. Dono steps alag hain, ek doosre ki jagah nahi
   lete — ye baat restore screen par saaf likhni hai.

## 10. Abhi bhi OPEN — code se pehle lock karne wale decisions

1. Non-seed recovery ka final model: layered model (Section 0.1) ya
   permanent "kabhi nahi" — decide karna baaki hai (`docs/24` P1-6).
2. Numbers: reset token expiry (starting proposal 1 ghanta), token
   length (kam se kam 128 bits), signup velocity (example 3/hour),
   invite expiry, session idle timeout, refresh-token rotation —
   sab code phase se pehle lock hone chahiye.
3. Public signup ki verification ka exact tareeka (kaun sa channel,
   kaun sa token flow) — Phase 4 design me lock hoga.
4. Admin reset ke liye support channel ka naam + pehchaan
   verification ka exact tareeka — team/private setup me lock hoga.
5. App-password revoke rule ka final faisla: main password
   change/revoke hone par app passwords bachenge ya revoke honge —
   `docs/13` vs `docs/21`/`docs/25` me contradiction abhi bhi hai,
   is doc se wo close nahi hota.
6. `docs/13-testing-qa.md` me is doc ke tests abhi add karne hain —
   is doc me sirf flow likha hai, test cases nahi badle gaye hain.
   Add karne wali tests: Turnstile Siteverify test, open-relay nahi
   (ye `docs/22` se hai), reset token hashed-storage + single-use +
   expiry test, enumeration test (same message + timing),
   secondary-email verification test, admin-reset audit-log test,
   seed backup-verification test, seed restore fingerprint-mismatch
   test, public-signup velocity + disposable-domain test, reserved
   names test, deleted-address recycle-nahi test.

## 11. System sender — OTP/verification mail kis email se jayega

Ye section is doc me baad me add hua hai, kyunki pehle docs me OTP/
verification mail ka sender kahin define hi nahi tha — sirf `abuse@`
aur `postmaster@` mandatory monitored inbound mailboxes ke taur par
the (`docs/22`, `docs/23`), sender ke taur par nahi. Ab ye DRAFT rule
hai:

1. **Bhejne wala system hoga, koi insaan nahi:** Na user ka apna
   Dusrel address, na kisi admin ka personal email, na kisi employee
   ka mailbox. OTP/verification/reset mail ek fixed system address
   se jayega.
2. **Proposed sender (domain abhi bhi docs me example hai, isliye ye
   bhi example hai):** From: `Dusrel <account@dusrel.com>`,
   Reply-To: `support@dusrel.com`.
   - `noreply@` mat use karo — noreply trust kharab karta hai, user
     ka reply kahin nahi jata, aur "ye OTP maine nahi manga" wala
     support sawaal dab jata hai. Reply-To monitored support mailbox
     hona chahiye.
   - From name pehchana hua hona chahiye ("Dusrel"), taaki user
     usko spam na samjhe.
   - `postmaster@`/`abuse@` ko sender mat banao — wo ISP/postmaster
     reports aur abuse complaints ke liye inbound mailboxes hain,
     unse OTP bhejna unka kaam bigaad dega.
3. **Bhejne ka rasta:** Dusrel ka apna Stalwart SMTP, VPS se hi.
   Us sending domain par SPF + DKIM (2048-bit) + DMARC alignment
   hona chahiye, valid PTR, TLS — Gmail guidelines: sab senders ke
   liye SPF ya DKIM, bulk ke liye teeno, aur From domain ka SPF/
   DKIM domain se align hona zaroori hai, warna DMARC fail hoga.
   Spam rate Postmaster Tools me 0.30% se neeche rakhni hai.
4. **Alag transactional pehchaan:** Account wale mails (OTP,
   verification, reset, notification) ke liye alag address + alag
   DKIM selector rakho, marketing se alag. Single VPS IP par IP
   reputation to shared rahegi hi, isliye domain/selector ka alag
   hona hi pehli line of defence hai — aur isi wajah se spam account
   ko jaldi suspend karna OTP delivery ke liye bhi zaroori hai
   (`docs/28` Section 5 dekho).
5. **OTP ke rules (NIST 800-63B, starting proposals, lock nahi):**
   Kam se kam 6 digits, CSPRNG se bana ho, lifetime 10 minute se
   zyada nahi (link token wali 1 ghante ki expiry yahan nahi
   chalegi — chhota code kamzor hota hai, isliye window chhoti hoti
   hai), failed attempts bounded hon (starting proposal: 5 galat
   koshish par code invalid, aur naya code bhejne se failed count
   reset nahi hoga), per-recipient hourly send cap + per-minute
   check cap hon, limit par generic 429 mile. OTP bhi database me
   hashed store ho, plaintext me nahi, single-use ho.
6. **OTP mail me kya hoga:** Purpose (kis kaam ke liye hai), code,
   expiry (10 minute), aur "agar tumne nahi manga to ignore karo aur
   support se sampark karo" — password kabhi nahi, aur aisa link
   nahi jo click karte hi auto-login kara de.
7. **OTP vs link ka fark:** Logged-in haalat me secondary email
   verify karne ke liye OTP (same session me code type karna) achha
   UX hai. Logged-out reset ke liye link behtar hai (Section 3) —
   kyunki OTP + email akela reset ke liye kamzor padta hai. Dono
   case me OTP/reset sirf verified secondary email par jayega,
   kabhi usi Dusrel mailbox par nahi jisme user locked out hai.
8. **Email OTP akela strong factor nahi hai:** Sensitive kaam ke
   liye OTP ke saath existing session ya MFA bhi chahiye.

## Cross-references

- `docs/28-admin-dashboard-moderation.md` — admin roles, account
  states, spam lifecycle, appeal, aur dashboard scope. OTP delivery
  ki reputation us doc ke spam-suspension rule par bhi depend karti
  hai.
- `docs/21-mail-core-user-flows.md` F1, F2, F3, F4, F5, F6, F16 —
  is doc ka base, ye doc unka extension hai.
- `docs/02-prd.md` — public signup Phase 4 tak nahi, E2EE warning.
- `docs/07-security-e2ee.md`, `docs/24-mail-core-e2ee-privacy.md` —
  seed loss = data loss, non-seed recovery P1-6, deleted alias
  recycle-nahi.
- `docs/22-mail-core-security-bot-ddos.md` — Turnstile, rate limits,
  login buckets.
- `docs/25-mail-core-day1-checklist.md` — forgot flow, 2FA recovery,
  admin-invite, weak-password rejection checklist items.
- ADR-009 (`docs/12-decisions-adr.md`) — public signup Phase 4 tak
  nahi. ADR-002 — v1 TypeScript only (is doc se language decision
  nahi badalta).
