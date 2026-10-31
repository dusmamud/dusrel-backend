# Admin Dashboard + Moderation — Roles, States, Spam, Appeal

Status: DRAFT — 2026-10-31
Source: Exa-verified best-practice report (2026-10-31, Exa Search API
route se — REST connector, MCP server nahi) + maujooda docs.
Sources: Gmail sender guidelines, NIST 800-63B (Bird Verify docs ke
through), OWASP Email Validation + Bot Management Cheat Sheets, AWS
SES enforcement, MailChannels outbound filtering, Litmus/Oracle
noreply guidance, Datadog/Amplitude RBAC guides, Canadian Centre for
Cyber Security admin-privilege guidance, Pithy account lifecycle,
ban-appeals best practices.

Ye doc `docs/21-mail-core-user-flows.md` F1/F16 aur
`docs/22-mail-core-security-bot-ddos.md` ke admin/abuse hisse ko
extend karta hai, unko replace nahi karta. `docs/21` F16 me sirf ye
tha: admin user banata/disable/delete karta hai, quota set karta hai,
abuse par block/unblock kar sakta hai. `docs/22` me sirf ye tha: spike
par auto-suspend sending only, aur admin panel public internet par
nahi hoga (Stalwart webadmin). Baaki sab — roles, dashboard screens,
account states, spam lifecycle, appeal — is doc se pehle docs me
nahi tha, aur ye doc un gaps ko bharta hai.

**Numbers ka note:** Is doc me diye numbers (OTP lifetime 10 minute,
failed attempts 5, signup velocity 3/hour ka example) starting
proposals hain, final locks nahi. Jahan decision open hai, wahan saaf
`OPEN` likha hai.

## 1. Admin dashboard ek alag Next.js project hoga — future me

User decision (2026-10-31): Admin dashboard ke liye **ek alag Next.js
project hoga, future me.**

Iska matlab saaf hai:

- Admin dashboard ka code **web client monorepo `dusrel-web` ka hissa
  nahi hoga** (usme `apps/mail, drive, chat, meet, landing` hain —
  wo end-user apps hain, admin tool nahi hai).
- Admin dashboard ka code **is backend repo ka hissa bhi nahi hoga**
  — ye repo docs + backend services ka hai, dashboard ka frontend
  alag project me banega.
- Dashboard project ka **repo naam, deploy jagah aur banne ka Phase
  abhi OPEN hai** — user ne sirf ye decide kiya hai ki wo alag
  Next.js project hoga, baaki is doc me lock nahi hai. Repo naam
  apne man se nahi likha gaya hai.
- Dashboard **public web app nahi hoga:** Ye internal tool hai, isliye
  iska deploy public Cloudflare Pages jaisa open deploy nahi hoga —
  Section 3 ke access rules (VPN/IP allowlist, public internet se
  nahi) is par lagu honge. Exact hosting is doc me lock nahi hai.

## 2. Roles — RBAC, least privilege, groups se manage hon

Koi shared "admin" login nahi hoga. Har admin account ek pehchane hue
insaan (employee) se juda hoga, aur permissions groups/roles se
milenge, ek-ek karke haath se nahi.

| Role | Kar sakta hai | Nahi kar sakta |
|---|---|---|
| Superadmin / Owner | Org config, role dena/hatana, billing dekhna, destructive kaam (permanent ban, delete) — destructive kaam par dobara re-authenticate + ideally doosre superadmin ki approval | Kisi user ka mail body, private key, seed, password, reset token dekhna (koi role nahi dekh sakta) |
| Admin | Roz ka kaam: user banana/disable karna, quota set karna, suspend/unsuspend karna, abuse queue review karna, audit log dekhna (edit nahi) | Permanent ban/delete akele karna (Superadmin approval chahiye), audit log edit karna, mail body/private key dekhna |
| Support | User ka status dekhna, sessions dekhna, reset link bhejna (approval ke saath) | Permanent ban/delete karna, quota/policy badalna, mail body/private key dekhna |

Rules:

- **Least privilege:** Har role ko sirf utna haq milega jitna uske
  kaam ke liye zaroori hai. Superadmin role bahut kam trusted logon
  ko milega, roz ke kaam ke liye custom/operational roles banenge.
- **Groups default layer hain:** Ek group ke saare members ko wahi
  permissions milenge — isse onboarding, offboarding aur audit
  aasan hoga. Ek user ke liye alag-alag one-off permissions mat do.
- **Regular access review:** Kaun kis role me hai, iski review
  regularly hogi — kaun kab review karega, ye operations runbook me
  lock hoga (is doc me date lock nahi hai).
- **Employee accounts alag hon:** Admin ka account uske normal mail
  account se alag hoga, alag credentials, alag MFA. Admin account se
  internet/email browsing nahi hogi. Ye rule Canadian cyber guidance
  se hai aur `docs/22` ke "admin panel public internet par nahi"
  wale rule se match karta hai.

## 3. Admin panel ki security — ye rules dashboard par lagu honge

1. **MFA mandatory:** Saare privileged accounts par MFA hoga — bina
   MFA ke koi admin login nahi hoga, chahe role koi bhi ho.
2. **Public internet se nahi:** Admin panel + Stalwart webadmin
   public internet par nahi khulenge. Access sirf VPN/IP allowlist
   se hoga, dedicated management access se hoga (`docs/22` me ye
   rule webadmin ke liye pehle se hai, dashboard par bhi wahi lagu
   hai).
3. **Sensitive kaam par dobara authentication:** Role badalna,
   permanent ban, delete, quota/policy badalna — in par dobara
   existing factor se re-authenticate karna padega.
4. **Session timeout chhota:** Admin session ka idle timeout normal
   user session se chhota hoga (number code phase me lock hoga).
5. **Audit log — sabse zaroori rule:** Har admin action log hoga —
   kisne, kab, kis account par, kya action, kya reason. Audit log ko
   admin khud edit nahi kar sakega, wo alag/tamper-resistant jagah
   store hoga, aur regularly review hoga. Log me mail body, private
   key, seed, password, reset token kabhi nahi aayega.
6. **Kabhi nahi dikhega:** Dashboard par koi bhi role user ka mail
   body, E2EE decrypted content, private key, seed phrase, password
   ya reset token nahi dekh sakta. Dashboard me sirf metadata
   dikhega: status, sessions, aliases, quota usage, state history,
   audit log. Ye rule `docs/21` F16 ke "admin ko user ka mail body
   ya private key kabhi nahi dikhni chahiye" wale rule ka dashboard
   version hai.

## 4. Account states — ek saaf model

Pehle docs me states define nahi thi — sirf "block/unblock" aur
"sending auto-suspend" naam se the. Ab ye model DRAFT rule hai:

| State | Matlab | Kaise khatam hoga |
|---|---|---|
| Active | Normal — login, send, receive sab chalega | — |
| Sending-suspended (auto) | Login + receive + read chalega, send band hoga. Spike/compromised/spam shak par pehla kadam yehi hai (`docs/22` me pehle se hai, yahan state ka naam diya gaya hai) | Operator review karke wapas kholega, ya auto-review ke baad |
| Suspended (temporary ban) | Sign-in, token refresh, koi action — sab band, jab tak `suspended_until` khatam na ho ya operator wapas na khole. User ko reason + end date dikhegi | `suspended_until` khatam hone par apne aap, ya operator reinstate karega |
| Banned (permanent) | Hamesha ke liye sign-in band (appeal se palat sakta hai to alag baat hai). Data retention policy ke hisaab se rakha jayega, address kabhi recycle nahi hoga | Sirf appeal uphold na hone par nahi — appeal jeetne par reinstate hoga, warna permanent rahega |
| Disabled | Admin ki taraf se non-abuse wajah se band (jaise team se nikalna). Dikhega suspended jaisa, lekin reason category alag hogi | Operator wapas kholega |
| Deleted | Sign-in band, data purge window ke baad erase hoga, us window tak restore ho sakta hai. Deleted, suspension se upar hai — deleted account ko pehle restore karo, tabhi suspend/unsuspend ki baat hogi | Purge window tak restore, uske baad erase |
| Under review / quarantine | Spam-shak wala account, sending pause, review queue me | Review ke faisle se: reinstate, suspend ya ban |

Rules:

- **Error code:** Suspended/banned/deleted account ko 403 milega,
  401 nahi — kyunki dobara login karne se kuch nahi hoga, aur user
  ko saaf reason + (temporary ho to) end date dikhegi.
- **State change = history ke saath:** Har state change ek lifecycle
  history table me jayega — action, actor, reason, time — state
  change ke saath ek hi transaction me, taaki state ho aur history
  na ho, ye kabhi na ho. History user row erase hone ke baad bhi
  audit ke liye bachegi (bina mail body ke).
- **Client apni state khud nahi likh sakta:** State sirf operator/
  system transitions se badlegi, user ke request se seedha nahi.
- **Ek hi waqt par ek state:** Deleted account ko suspend ya
  reinstate nahi kiya ja sakta — pehle restore, phir baaki action.

## 5. Spam account ka lifecycle — graduated response

Pehle docs me spam ke liye sirf rate limit, block aur auto-suspend
sending only tha — poora lifecycle nahi tha. Ab ye DRAFT rule hai:

**Detection signals (user ko exact rules mat batao, warna wo bypass
kar lega):** Signup velocity, disposable domains, high-entropy
address, outbound spike, bounce/complaint rate, spamtrap hits,
content scoring, dictionary attack — isme se kaafi `docs/22`/`docs/23`
me pehle se hain.

**Steps — ek dum delete nahi:**

1. Review queue me dalo (under review, sending pause ho sakta hai).
2. Sending-suspended karo (Section 4) — account delete nahi hoga.
3. Suspended (temporary ban) karo, agar violation saabit ho.
4. Banned (permanent) karo, agar repeat/severe violation ho.
5. Sirf extreme/severe case me turant sending pause hoga, bina
   review wait kiye (AWS SES aur MailChannels ka bhi yehi model
   hai: review, phir pause, phir ban).

**False positives ka rasta hona chahiye:** Ratio-based auto-block
temporary hota hai. User "not spam" report kar sake, support se
sampark kar sake, aur human review maang sake. Pehli signal par
auto-delete kabhi nahi hoga.

**Ek account ka spam poore VPS IP ki reputation kharab karta hai:**
Isliye sending-suspend jaldi lagna sirf us ek user ke liye nahi,
balki OTP/verification delivery (`docs/27` Section 11) aur saare
users ki deliverability ke liye zaroori hai.

## 6. Appeal process — notice + structured appeal

Pehle docs me appeal process kahin nahi tha. Ab ye DRAFT rule hai:

**Notice me ye hona chahiye:** Kaun sa action liya gaya, kis
rule/policy category ke under, temporary hai ya permanent, appeal
ho sakti hai ya nahi, appeal ki deadline kya hai, appeal me kya
jaankari deni hai, case reference number kya hai. Reporter ki
pehchaan ya detection ke tareeke disclose nahi honge, lekin itna
context zaroor hoga ki user samajh sake kya hua.

**Appeal ho sakti hai:** Temporary suspension, permanent ban,
feature restriction, abuse-triggered lockout par.

**Appeal aam taur par nahi hogi:** Obvious bot spam ban, legal
removal, aur wahi facts par dobara-dobara appeal par. Ye queue ko
un cases se bharne se bachayega jo dobara dekhe hi nahi ja sakte.

**Structured form se appeal hogi, free-text inbox se nahi:**
Reference number, action, user ka explanation, nayi jaankari/
evidence, access chahiye ya data chahiye. Similar cases par same
standards lagenge (consistency), har case ko same bhaari review
nahi milega (proportionality), har faisla audit ke liye document
hoga.

**Faisla:** Reinstate, kam karo (ban → temporary suspension), ya
uphold — reason ke saath, log ke saath, aur user ko secondary
email par notice jayegi (kyunki uska Dusrel mailbox band ho sakta
hai, isliye notice sirf Dusrel mailbox par nahi jayegi).

## 7. Dashboard me kya-kya screens honi chahiye (scope, UI design nahi)

Ye scope hai, UI design ya component list nahi hai — wo dashboard
project me banegi:

- **Users:** State/quota/created/last-active se search-filter, user
  detail me sessions, aliases, quota usage, state history, audit
  log — bina mail body ke.
- **Abuse queue:** Flagged accounts, spike alerts, complaint/bounce
  dashboard, review actions (approve/pause/suspend/ban).
- **System:** Mail queue, R2/Cockroach health, Postmaster spam rate,
  SPF/DKIM/DMARC reports, blocklist status.
- **Audit:** Saare admin actions, actor/action/user se filter,
  review ke liye export.
- **Employees:** Role assignment, MFA status, aakhri admin login,
  access review ki date.

## 8. Abhi bhi OPEN — code/dashboard se pehle lock karne wale decisions

1. Dashboard project ka repo naam, deploy jagah aur banne ka Phase
   — sirf ye lock hai ki wo alag Next.js project hoga, future me.
2. Numbers: admin session idle timeout, OTP/velocity ke numbers
   (`docs/27` Section 11 se), appeal deadline, purge window ki
   length, access review ki frequency — sab code phase se pehle
   lock hone chahiye.
3. Destructive kaam (permanent ban/delete) par doosre superadmin ki
   approval mandatory hogi ya sirf re-authentication kaafi hogi —
   ye rule lock karna baaki hai.
4. Admin reset ke liye support channel ka naam + pehchaan
   verification ka exact tareeka (`docs/27` Section 10 se bhi open
   hai).
5. `docs/13-testing-qa.md` me is doc ke tests abhi add karne hain —
   is doc me sirf scope/rules likhe hain, test cases nahi badle
   gaye hain. Add karne wali tests: role-permission matrix test
   (har role ke liye allowed/denied actions), admin MFA-required
   test, admin panel non-public access test, state-transition test
   (har state se har state tak allowed/blocked), audit-log
   tamper-proof test, mail-body/private-key never-visible test,
   appeal flow test (notice + form + decision + notification),
   spam graduated-response test (review → pause → suspend → ban),
   false-positive reinstate test, deleted-address recycle-nahi
   test.

## Cross-references

- `docs/21-mail-core-user-flows.md` F1, F16 — admin invite aur
  block/unblock ka base, ye doc unka extension hai.
- `docs/22-mail-core-security-bot-ddos.md` — auto-suspend sending
  only, Turnstile, rate limits, admin panel non-public rule,
  bounce/complaint dashboard.
- `docs/23-mail-core-infra-deliverability.md` — SPF/DKIM/DMARC,
  postmaster/abuse mailboxes, complaint monitoring.
- `docs/25-mail-core-day1-checklist.md` — compromised-account
  containment (suspend sending → reset → revoke).
- `docs/27-account-signup-recovery.md` — secondary recovery email,
  admin reset, OTP sender rule (Section 11), appeal notice ka
  secondary-email channel.
- `docs/08-mail-deliverability.md` — sender authentication
  (SPF/DKIM/DMARC) ka base, OTP sender usi par chalega.
- ADR-009 (`docs/12-decisions-adr.md`) — public signup Phase 4 tak
  nahi; dashboard is rule ko badalta nahi hai.
