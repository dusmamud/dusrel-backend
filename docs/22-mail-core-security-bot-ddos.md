# Mail Core — Security, Bot Protection, DDoS, Abuse (Detailed)

Status: DRAFT — 2026-10-31
Source: Exa-verified security subagent (REST connector, not MCP).
Ye doc `03-trd.md`, `07-security-e2ee.md`, `09-deployment.md`,
`13-testing-qa.md`, `14-operations-runbook.md` ko replace nahi karta.
Unme jo generic rate-limit / monitoring pehle se hai, yahan uska
concrete, testable version hai. Jo control yahan nahi hai, wo abhi
bhi missing mana jayega.

## Sabse bada sach — pehle ye samajh lo

Web apps Cloudflare Pages par shield ho sakti hain, lekin mail VPS
ko HTTP proxy ke peeche nahi chhupa sakte. MX record proxy nahi ho
sakta, mail hostname DNS-only rehna hi hai, aur port 25 par SMTP
chalta hi rehna hai. Isliye "hum Cloudflare use karte hain, isliye
DDoS-proof hain" ka dawa mail ke liye galat hai. Mail VPS ka apna
alag DDoS plan chahiye, aur single VPS = single point of failure
ye accepted risk ke taur par likha rahega — 99.99% uptime ka dawa
pehle se hi mana hai, DDoS-proof ka dawa bhi mana hai.

## 1. Bot protection — har human-facing form par

Pehle docs me bot protection ka zikr hi nahi tha. Generic rate
limit bot protection nahi hai — distributed botnet per-IP limit ko
paar kar jata hai.

- **Cloudflare Turnstile (Managed widget recommended)** in par:
  login, password-reset request, alias creation, password-link
  creation, aur Phase 4 me signup.
- Turnstile kaam kaise karta hai: non-interactive JavaScript
  challenges (proof-of-work, proof-of-space, browser/API probing),
  asli user ko aksar koi puzzle nahi dikhta.
- **Server-side validation mandatory hai:** browser widget se token
  milta hai (max 2,048 chars, 300 second me expire, single-use) —
  backend ko Cloudflare Siteverify API se verify karna hi hoga.
  Sirf client widget lagana adhura hai, form tab bhi unprotected
  rahega.
- **Bot Fight Mode:** Free wala baseline, ya Pro/Business/Enterprise
  par Super Bot Fight Mode — Definitely automated -> Managed
  Challenge, phir Block (Security Events dekh kar); Likely automated
  -> Managed Challenge; Verified bots -> Allow. Login paths par
  domain-wide default se strict rule lagega.
- Turnstile/CAPTCHA kabhi akela defence nahi hoga — rate limit aur
  takeover detection ke saath hi chalega.
Sources: Cloudflare Turnstile docs, Cloudflare account-takeover
use-case docs.

## 2. Rate-limit tiers — numbers ke saath, warna test nahi ho sakta

Pehle docs me sirf "rate limiting" shabd tha, tier nahi the.
Neeche wale numbers **starting proposal** hain, final lock code
phase me hoga — lekin bina numbers ke implementer bana nahi sakta
aur tester verify nahi kar sakta, isliye ye doc me likhna zaroori hai:

- **Login (HTTP + API):** per-IP *aur* per-account bucket, progressive
  delay phir temporary lockout (proposal: 5 fail -> delay, 10 fail ->
  15-30 min lockout us account+IP pair ke liye). Kabhi sirf failed
  login par permanent lockout nahi — wo khud account-lockout DoS
  ban jayega.
- **TOTP:** alag, bahut strict bucket (proposal: 5-10 galat code,
  phir dobara password se re-authenticate karna padega). TOTP sirf
  6 digit ka hai, shared login bucket kaafi nahi hai.
- **Password-reset requests:** strict per-IP aur per-account limit +
  single-use, kam expiry token + Turnstile.
- **API / JMAP:** per-user aur per-IP quota, `429` + `Retry-After`
  ke saath, silent drop kabhi nahi.
- **SMTP AUTH / IMAP / JMAP auth:** HTTP login wali hi brute-force
  policy + IP auto-block (neeche).
- **Logging:** har rate-limit hit par IP, account (agar pata ho),
  endpoint, timestamp — aggregate "rate-limit hits" kaafi nahi hai.

## 3. Stalwart SMTP throttling — inbound aur outbound, dono

Stalwart ke throttles pehle kabhi specify nahi hue the. Default
bina review ke ship karna dono taraf risk hai: bahut loose ho to
dictionary/spam flood, bahut tight ho to asli mail defer hoke user
ko lagega mail toot gaya hai.

- Throttle ka matlab: `count` per `period`, key ho sakti hai:
  `remoteIp`, `sender`, `senderDomain`, `rcpt`, `rcptDomain`,
  `heloDomain`, `authenticatedAs`, `listener`, `localIp`, aur
  optional `match` expression.
- Limit cross hone par **defer** hoga (`452 4.4.5 Rate limit
  exceeded, try again later`), refuse nahi — asli server retry
  karega, spam run atak jayega.
- **Review karne wale Stalwart defaults:** 5 connections/second per
  sender IP, aur 25/hour per senderDomain -> same recipient (ye
  authenticated users par bhi lagta hai, isliye asli high-volume
  sender ko `match`-restricted override milega, global raise nahi).
- Kam se kam ye throttles lock honge: per-IP connection, per-
  senderDomain->rcpt, per-rcptDomain (dictionary-attack defence),
  aur alag outbound per-authenticated-user aur per-domain.
- Inbound port-25 throttles par `match` lagana hai (jaise
  `local_port == 25`), taaki submission ports (465/587) galti se
  usi rule se throttle na ho jayein.
- `smtp.rate-limit-exceeded` events log honge aur sustained
  throttling par alert aayega — ye dictionary attack ya compromised
  account ki pehli warning hai.
Sources: Stalwart inbound rate-limit docs, Stalwart throttle object docs.

## 4. Brute-force, dictionary-attack, enumeration defence

Pehle docs me "fail2ban" shabd hi nahi tha, na hi VRFY/EXPN,
tarpitting ya greylisting ka named control tha.

- Stalwart ka automatic IP blocking on hoga (repeated auth failure
  aur exploit scan par), plus OS-level fail2ban (ya equivalent)
  SSH aur baaki exposed services ke liye — aur legitimate user
  (shared NAT ke peeche) ke liye documented unblock path hoga.
- **Anti-enumeration:** existing vs non-existing recipient/account
  ke liye response aur timing ek jaisi hogi jahan protocol allow
  kare; VRFY/EXPN disable honge; unknown recipient ko SMTP session
  me hi reject karna hai (neeche P0-9 bhi), taaki RCPT probing se
  address list harvest na ho; RCPT attempts per IP throttle honge.
- Greylisting unknown senders ke liye cheap first filter hogi,
  known legitimate senders allowlist me honge taaki asli mail sirf
  ek baar delay ho.
- Central failed-auth log + alert: ek IP se X failed SMTP/IMAP/JMAP
  auth Y minute me -> auto-block + operator alert. Ye alert pehle
  wale alert list (queue/disk/5xx) me nahi tha.

## 5. DDoS plan — mail VPS ke liye alag

- **DNS sach:** MX proxy nahi ho sakta; sirf mail ke liye wali
  A/AAAA record (jaise `mail.dusrel.com`) DNS-only rehni hi hai;
  Cloudflare default proxy se SMTP port 25 proxy nahi hota, aur
  mail record ko proxy karne par mail server Cloudflare IP se
  connect karega, asli server se nahi — delivery toot jayegi.
  Sirf Cloudflare Spectrum (paid, alag se configure) SMTP proxy kar
  sakta hai — ye default Pages/Workers protection nahi hai.
- **Consequence:** Mail VPS ka IP public hi rahega (MX + PTR usi
  par resolve honge). Use web origin ki tarah chhupa nahi sakte.
  Isliye mail ko web/API wale VPS se alag rakhna behtar hai, taaki
  mail flood web apps ko na giraye aur web flood mail ko na giraye.
- **Jo control lagu honge:** VPS provider / upstream ka L3/L4 DDoS
  mitigation launch se pehle confirm karna hai (assume nahi karna),
  firewall me sirf 25/465/587/993/143/80/443 khule hon, baaki sab
  drop, OS + Stalwart level par SYN-flood / connection-rate limit,
  queue shedding deferral (452) se hogi, mail drop karke nahi.
- Proton ke published DDoS experience ka wahi point hai: port 25
  ko chalta rakhna hai, isliye zyadatar DNS-redirection DDoS
  solution mail traffic par kaam nahi karte.
Sources: Cloudflare DNS proxy-status use-cases, Cloudflare
origin-protection docs, Proton DDoS protection guide.

## 6. Outbound spam / compromised-account containment — IP reputation ka killer

Pehle docs me inbound spam ka test tha, outbound containment nahi
tha. Ek compromised account poore domain ki IP reputation kuch
ghanton me kharab kar sakta hai, phir har user ka mail spam me
jayega. Ye Phase 4 ki cheez nahi hai, Day 1 ki hai.

- **Default per-account aur per-domain outbound limits** submission
  par enforce honge, soft deferral (451/452) ke saath, silent drop
  nahi — taaki asli client retry kare. Starting proposal (lock
  karna hai, blind copy nahi): 500 messages/hour per user aur
  2,000/hour per domain, envelope recipients gin kar (1 message
  20 recipients ko = budget ka 20).
- **New-IP warmup cap alag, automatic control hoga:** proposal —
  day 1 par ~50 recipients/hour se shuru, ~25%/day badhao, target
  cap tak. Naye VPS IP par day 1 me blast kabhi nahi hoga, chahe
  account compromise bhi ho jaye.
- **Spike detection + auto-suspend (sending only):** account ka
  volume, recipient count ya bounce rate apne baseline se achanak
  badhe to sending auto-suspend hogi (account delete nahi), operator
  review + password reset ke baad hi sending wapas milegi.
- **Per-message accountability:** har sent message par authenticated
  user log hoga, aur header me authenticated username (ya uska hash)
  hoga, taaki spam complaint par ek account minutes me trace ho.
- **Weak-password rejection:** signup aur password change par common/
  compromised passwords block honge — chhote mail service ka zyadatar
  "spam" hijacked account se aata hai, stranger relay se nahi.
- **Outbound spam scanning** send se pehle hoga, sirf inbound
  filtering kaafi nahi hai. Phase 1 me personal mailbox se bulk/
  marketing sending nahi hogi — bulk ke liye alag, explicitly
  approved path aur limits hongi.
Sources: Spamhaus outbound-spam guidance, Microsoft Defender
outbound-spam protection, MailDock outbound rate limits.

## 7. Account-takeover detection — password + TOTP se aage

- Naye device/IP/ASN/country se login par user ko email (verified
  address par) + in-app "new login" notice milegi, device/IP/time
  ke saath aur one-click "revoke all sessions" action ke saath.
- Sender ka location/IP/server route account ke history se alag ho
  to warn ya block hoga — ye ITU-T X.1236 ka stated requirement hai,
  sirf nice-to-have nahi.
- Password change par daily breached/weak-password check hogi
  (k-anonymity API se, poora password kabhi bahar nahi bheja jayega),
  takeover detect hone par forced password reset hoga.
- Credential-stuffing layer: login par Turnstile + IP-reputation
  throttling + device/session history, taaki 10,000 leaked passwords
  try karne wala bot per-account bucket tak pahuche hi nahi.
- Refresh-token reuse detection: rotation ke baad purana token
  replay hua to poori session family turant revoke hogi.

## 8. Naye attack surfaces ke abuse rules — jo docs khud banate hain

Docs teen naye abusable surface banate hain, bina abuse rule ke:

- **Password links:** high-entropy, unguessable link ID (sequential
  nahi), per-link fetch-attempt rate limit, optional max-views,
  kam default expiry, aur link-open endpoint par Turnstile ya rate
  limit — warna bot link ID ya password brute-force kar lega.
  Guess ho sakne wala link, link na hone se bura hai.
- **Aliases:** per-user alias creation cap (proposal: low double-digit
  total, low per-day rate) aur impersonation pattern ban
  (`admin`, `support`, `postmaster` jaise non-admin ke liye). Bina
  cap ke alias creation free spam-sender factory ban jayega.
- **Key directory:** login-only, uniform-response rule rahega, plus
  per-user lookup rate limit, taaki logged-in bot directory harvest
  na kar sake.
- **Cost-abuse caps:** alias/link/upload creation per user per day,
  taaki ek account R2/Cockroach bill ko DDoS na bana de. R2 egress
  free hai, lekin storage aur Class A/B operations free nahi hain.

## 9. Open-relay, backscatter, bounce — test hi nahi tha

- **Hard rule:** Outbound mail sirf authenticated submission se;
  unauthenticated mail sirf local recipients ke liye, RCPT verify
  ke baad. Test explicitly hoga: unauthenticated relay attempt fail
  hona chahiye, open-relay tester ko "closed" batana chahiye.
- **Reject unknown recipients SMTP session me (550),** accept-then-
  bounce kabhi nahi — accept-then-bounce backscatter banata hai, jo
  operator ki galti na hone par bhi IP blocklist karwa deta hai.
- **Mandatory mailboxes:** `abuse@` aur `postmaster@` jo sach me
  monitor honge, plus DMARC aggregate-report inbox aur feedback-loop /
  complaint handling ka process. DMARC sirf DNS record set karna
  nahi hai, usko padhne ka process bhi chahiye.
- **Bounce-rate alert:** sustained bounce rate locked threshold se
  upar jaye to wahi operator alert aayega jo queue spike par aata hai.

## 10. HTTP-layer shielding — Pages/API/admin

Mail VPS ka problem ye nahi hai ki HTTP layer ko shielding nahi
chahiye — balki HTTP layer hi ek layer hai jise Cloudflare shield
kar sakta hai, isliye use sach me shield karna hai:

- Cloudflare WAF + Bot Fight rules web apps aur Hono APIs par
  (login/API paths par sabse strict), aur koi blanket "API ke liye
  WAF skip karo" rule nahi hoga.
- **Admin panel public internet par nahi hoga:** Stalwart webadmin
  aur koi bhi admin UI IP allowlist, VPN/Tailscale, ya alag admin
  hostname + apni auth + Turnstile + rate limit ke saath hi
  khulega. Sirf password se protected admin panel brute-force ka
  target hai.
- **Origin hiding (HTTP ke liye):** web/API DNS records Cloudflare
  se proxy (orange cloud), origin firewall par sirf Cloudflare IPs
  allow (jahan origin Cloudflare ke peeche hai), aur DNS/TXT records
  me leaked origin IP ka audit — Cloudflare origin-protection
  guidance ka wahi audit. Mail hostname DNS-only aur web hostname
  se alag rahega, MX ko proxied website wale hostname par mat
  point karna.

## 11. Security alerting + abuse incident playbook

Pehle runbook me queue/disk/5xx alert the, security alert nahi the.
Ab ye alerts lock honge (threshold code phase me final honge):

- Failed-auth storm: ek IP ya ek account par X failed login/SMTP
  auth Y minute me -> auto-block + operator alert.
- Outbound spike: account/domain apna outbound budget baar-baar
  cross kare (proposal: 60 minute me 10 throttled sends) -> warning
  + auto-suspend sending pending review.
- Blacklist / DMARC: koi bhi blocklist listing, ya DMARC failure
  rate threshold se upar -> same-day operator action + delisting
  procedure jo launch se pehle likha hoga, outage ke beech me nahi.

**Abuse playbook steps (launch se pehle likhe honge):**
1. Us account ki sending suspend karo.
2. Forced password reset + sessions/app passwords revoke karo.
3. Headers/logs ko evidence ke taur par preserve karo.
4. Dekho kya baaki accounts wahi IP/device/password share karte hain.
5. Zaroorat ho to affected recipients ko notify karo.
6. Fix ka evidence ke saath delisting request karo.

## 12. Inbound malware / phishing / attachment controls

Pehle 5 docs me inbound protection sirf "spam folder me jayega"
tha, virus/attachment/link ka named rule nahi tha:

- Explicitly enable + test karna hai: DNSBL checks, greylisting,
  phishing protection (homograph/sender-spoofing), spam scoring —
  aur false-positive path (user spam se release kar sake, operator
  legitimate sender allowlist kar sake).
- **Attachment policy lock hogi:** executables/scripts ko extension/
  MIME se block ya quarantine karo, delivery se pehle antivirus
  engine (jaise ClamAV via milter/integration) se scan karo, aur
  maximum attachment size SMTP time par enforce karo, upload ke
  baad nahi.
- **Webmail link handling:** remote content by default load nahi
  hoga, link auto-follow nahi hoga, aur display-text vs href
  mismatch par warning milegi — ye webmail UI ka classic phishing
  vector hai.

## P1 — Day 1 me design karo, second wave me ship kar sakte ho

- **Cost-abuse caps:** alias/link/upload/R2 operations per user per
  day, Cockroach connection/statement limits per service.
- **Automated reputation monitoring:** weekly manual blacklist check
  ki jagah daily automated DNSBL check, DMARC aggregate-report
  parsing, bounce/complaint dashboard, pehli listing par alert.
- **Session/token hardening:** refresh-token rotation + reuse
  detection, device session list + per-device revoke, kam access-
  token lifetime, aur cookie-based auth ho to CSRF rule — JWT bearer
  ho to CSRF risk kam hai, lekin doc me transport aur uska CSRF
  rule dono likhe honge, abhi dono me se koi nahi likha hai.
- **Supply-chain defence:** dependency pinning + lockfile, backend
  images ka SBOM, signed Docker images / Pages deployments, aur
  least-privilege env (har service ko sirf apna schema/bucket,
  kabhi god credential nahi).
- **Geo/ASN blocking — optional, warning ke saath:** Day 1 par
  blanket geo-blocking nahi hogi; agar use bhi hui to Managed
  Challenge (Block nahi) suspicious ASN/IP-reputation band par,
  aur affected legitimate users ke liye allowlist path ke saath.

**Agar sirf ek cheez add karni ho to:** Outbound caps (section 6)
+ SMTP throttling (section 3) dono ek saath add karo. Bina inke ek
hijacked account ya ek botnet run ek VPS IP ko blacklist karwa
sakta hai jiss par har Dusrel user depend karta hai, aur tab koi
E2EE ya TLS delivery wapas nahi la payega jab tak delisting poori
na ho.
