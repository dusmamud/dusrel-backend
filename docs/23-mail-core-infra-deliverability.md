# Mail Core — Infra, Deliverability, Operations (Detailed)

Status: DRAFT — 2026-10-31
Source: Exa-verified infra subagent (REST connector, not MCP).
Ye doc `03-trd.md`, `04-architecture.md`, `06-database-design.md`,
`08-mail-deliverability.md`, `09-deployment.md`,
`14-operations-runbook.md` ko replace nahi karta. Unme jo pehle se
hai (SPF/DKIM/DMARC/PTR basics, VPS-move steps, backup ka idea,
monitoring targets) yahan dobara nahi likha gaya — yahan sirf wo
gaps hain jo unme nahi the.

## Pehle se covered — dobara mat likhna

- A, MX, SPF (`-all` preferred), DKIM, DMARC (`p=quarantine` pehle,
  phir `p=reject`), PTR/rDNS VPS provider se, Cloudflare DNS proxy
  OFF mail records ke liye.
- DKIM signing domain = visible From domain se align; SPF via `mx`
  preferred, taaki VPS move par SPF na toote.
- Stalwart built-ins: DKIM v1/v2, SPF, DMARC, ARC, DANE, MTA-STS,
  spam filter, DNSBL, greylisting, phishing protection, ACME TLS,
  DKIM key auto-rotation.
- New IP zero-reputation, gradual warmup, day one par bulk nahi,
  weekly blacklist check (MXToolbox-style).
- Inbox proof: mail-tester score, Gmail/Outlook/Yahoo test mail,
  headers me `dkim=pass` / `spf=pass` / `dmarc=pass`.
- VPS-move: low TTL (300s), Cockroach IP-allowlist me naya IP,
  wahi DKIM key, SPF via `mx`, purana VPS 24-48h parallel queue drain
  ke liye, naye IP par phir warmup.
- State externalised: Cockroach metadata only, R2 blobs, VPS compute
  only. Backup: Cockroach managed backup, R2 versioning, monthly
  restore test — "no restore test = no backup claim."

## P0-1. DMARC / TLS reporting ka receiving pipeline hi nahi hai

Docs me DMARC policy hai, lekin `rua` aggregate-report mailbox,
`ruf` forensic-report address, TLS-RPT mailbox, retention, ya parser
ka naam hi nahi hai.

- Stalwart received DMARC/TLS/ARF reports tabhi store karta hai jab
  retention configure ho (`holdMtaReportsFor`, set hone par 30 din);
  unset ho to reports rakh hi nahi jata.
- Stalwart DSN, DMARC, TLS, DKIM, SPF reports sirf un domains ko
  bhejta hai jo DNS me request karte hain.
- Isliye Day 1 se chahiye: `rua` + TLS-RPT mailbox, retention rule,
  aur report parser — warna DMARC policy lagane ka matlab hi nahi
  pata chalega (kaun fail kar raha hai, kaun spoof kar raha hai).
Sources: Stalwart reports docs, Stalwart management docs, Google
mail sender guidelines.

## P0-2. Gmail/Yahoo sender registration + complaint monitoring

Docs me "spam complaint par turant action" likha hai, lekin process
nahi hai:

- **Google Postmaster Tools registration** Day 1 se hogi.
- **Spam-rate threshold:** Gmail ke liye spam rate 0.3% se neeche
  rehna hai — is par alert lagega.
- **Feedback-loop / ARF handling** aur **suppression list** hogi —
  hard bounce aur spam complaint wale address ko dobara mail nahi
  jayega.
- Gmail ke rules (sab senders ke liye SPF *ya* DKIM, 5,000/day se
  upar Gmail par SPF + DKIM + DMARC, valid forward/reverse DNS,
  TLS, RFC 5322 formatting, DMARC alignment From ka SPF *ya* DKIM
  se, marketing/subscribed mail par one-click unsubscribe) — ye
  sab deliverability doc ka hissa honge, sirf "SPF/DKIM lagao" nahi.
Source: Google mail sender guidelines.

## P0-3. Bounce, queue-expiry, backscatter — rule hi nahi hai

Docs me "queue check daily" aur "bounce par action" hai, lekin:

- Hard-bounce vs soft-bounce ka rule nahi hai.
- Retry schedule nahi hai.
- Queue-expiry / DSN delay-notification timing nahi hai.
- Maintenance ke liye queue pause/resume procedure nahi hai.
- **Backscatter prevention:** bounce sirf asli envelope sender ko
  jayega, kabhi forged From ko nahi.
- Stalwart ka queue model ye sab support karta hai (per-recipient
  retry state, next-retry rescheduling, cluster-wide queue pause/
  resume) — lekin Dusrel runbook me ye wire nahi hua tha, ab hoga.
Source: Stalwart management docs.

## P0-4. Authenticated-submission aur open-relay controls

Docs me TOTP/app passwords user ke liye hain, lekin server rule
nahi tha:

- Port 25 par unauthenticated mail sirf internet se local delivery
  ke liye accept hoga.
- Submission (587/465) par authentication mandatory hogi.
- Relaying sirf authenticated users/systems tak limited hogi.
- Unauthenticated external client ka open-relay test fail hona
  chahiye.
- Compromised account open relay na hone par bhi abuse bhej sakta
  hai, isliye per-user/per-IP rate limit, login-failure monitoring,
  aur fail2ban-style blocking Day-1 config me hoga, Phase 4 me nahi.
  (Detail `docs/22-mail-core-security-bot-ddos.md` me hai.)

## P0-5. HELO/EHLO hostname aur FCrDNS check

Docs me PTR hai, lekin ye check nahi tha:

- HELO/EHLO hostname sending IP par resolve hona chahiye.
- IP reverse-resolve karke wahi hostname aana chahiye.
- Hostname har connection me consistent rehna chahiye.
- Provider-default ya placeholder HELO name misconfiguration/
  compromise ka signal mana jata hai, aur Microsoft/Comcast jaise
  receivers FCrDNS fail par reject kar dete hain.
Sources: mail-server deliverability checklist, Spamhaus sender
guidelines.

## P0-6. IPv6 — undecided, half-configured risk

Docs IPv4-only hain. Day 1 par explicit choice likhni hi hogi:

- **Option A:** IPv6 sending bilkul disable karo.
- **Option B:** AAAA + PTR + SPF `ip6:` publish karo, kam se kam
  /64 allocation ke saath aur valid reverse DNS ke saath.

Bina reverse DNS ke IPv6 se bhejna, ya /64 se chhoti allocation se
bhejna, classic spam signal hai. "Baad me dekh lenge" Day-1 option
nahi hai.
Sources: Spamhaus sender guidelines, deliverability checklist.

## P0-7. SPF/DKIM edge cases — happy path se aage

Docs me happy-path records hain, ye edge cases nahi the:

- **SPF 10-DNS-lookup limit:** nested `include:` chains samet 10
  se zyada lookup hua to PermError aayega, pass nahi — isliye
  include chain gin kar likhni hogi.
- **DKIM key size:** 2048-bit chahiye (Gmail ko kam se kam 1024-bit
  chahiye), aur lambi key ke liye split TXT strings chahiye.
- **DKIM selector rotation:** overlap ke saath hogi — purana +
  naya selector ek saath live rahenge, warna rotation ke beech ka
  mail fail hoga.
- **DMARC subdomain policy (`sp=`):** explicit value chahiye,
  default par chhodna nahi hai.
- **Forwarding SPF tod deta hai by design:** SRS envelope sender
  rewrite karta hai, isliye SPF forwarder ke domain se pass ho
  sakta hai lekin DMARC alignment phir bhi fail hoga — isliye
  forwarded mail ke liye ARC ka matlab hai.
Sources: deliverability checklist, Spamhaus sender guidelines,
forwarding/ARC docs, Google mail sender guidelines.

## P0-8. MTA-STS / DANE / DNSSEC — all-or-nothing, partial nahi

Docs me MTA-STS "baad me" hai, jo tabhi theek hai jab **koi**
MTA-STS record publish hi na ho:

- TXT record publish karke policy file na serve karna, ya DANE TLSA
  enable karke DNSSEC na lagana — ye partial setup, setup na hone
  se bura hai, kyunki ye failure banata hai.
- Policy file tabhi serve hogi jab `mta-sts.<domain>` par HTTPS se
  policy file + matching `_mta-sts` TXT record + TLS-RPT mailbox —
  teeno ek saath hon.
- Day 1 par explicit decision record hoga: poora implement karo,
  ya kuch bhi publish mat karo.
Source: Stalwart reports docs.

## P0-9. Backup consistency order — data-loss trap

Docs me "managed backup + versioning + monthly restore test" hai,
lekin order nahi tha, aur order galat ho to data loss hoga:

- **Order: data store pehle, blob store baad me. Kabhi reverse nahi**
  — kyunki data store blobs ko refer karta hai.
- Daily blob purge (Stalwart model me default 04:00, koi grace
  period nahi) do backups ke beech me nahi chalni chahiye, warna
  wo bodies delete kar degi jinko data-store backup abhi bhi refer
  karta hai.
- Versioned S3/R2 bucket purge hazard ko tabhi khatam karta hai
  jab restore data-backup completion time ke object versions se ho.
- Iske saath lock hoga: RPO/RTO targets, alag failure domain me
  backup, `config.json` + environment backup, search-index rebuild
  (index backup nahi hota, rebuild hota hai), aur ye rule ki running
  RocksDB directory ko file-by-file copy karna backup **nahi** hai
  (server roko, ya WAL samet atomic filesystem snapshot lo).
Source: Stalwart backup docs.

## P0-10. Stalwart-on-Cockroach compatibility — sabse bada architectural risk

Docs assume karte hain ki Stalwart ka PostgreSQL store CockroachDB
Cloud par chal jayega, lekin CockroachDB sirf wire-compatible hai
PostgreSQL se, documented differences ke saath. Ye test kiye bina
commit karna sabse bada risk hai:

- **Advisory locks:** session-scoped advisory locks support nahi
  hain — kuch session-lock functions bina lock liye silently
  succeed ho jate hain, sirf transaction-scoped advisory locks asli
  hain. Agar Stalwart (ya uske aas-paas ka Drizzle code) session
  lock par depend karta hai to mutual exclusion silently toot jayegi.
- **SERIALIZABLE isolation:** client ko `40001` restart-transaction
  aur `40003` ambiguous errors ko client-side retry logic se
  handle karna padega. Non-retrying writes contention par fail
  honge.
- Isliye Cockroach ko Stalwart ka store commit karne se **pehle**
  compatibility test hoga, plus connection-pooling aur region-
  latency limits. Agar test fail hua to ADR-004 (Cockroach vs
  cheaper Postgres) dobara khul jayega — ye test ADR ka hissa hai,
  optional nahi.
Sources: CockroachDB PostgreSQL compatibility docs, CockroachDB
transaction-retry error reference.

## P0-11. Resource limits aur disk-full protection — placeholder nahi

TRD me mail size, attachment size, quota "lock later" par chhode
gaye the. Ops ke nazariye se ye Day-1 gap hai:

- Ek mail loop, ek bada attachment, ya ek user ka mailbox bhar
  jana — VPS disk / R2 budget bhar sakta hai aur queue ruk sakti hai.
- Day 1 se lock hoga: max message size, per-mailbox quota, per-user
  send rate, queue disk quota, R2 cost guardrail/alert, Cockroach
  connection limits — ye numbers pehle incident ke baad nahi,
  launch se pehle lock honge.

## P0-12. RFC-required aur abuse mailboxes

Docs me inka naam hi nahi tha:

- `postmaster@` aur `abuse@` domain ke liye honge, aur inko kaun
  monitor karega, ye bhi likha hoga.
- Inke bina complaint handling (P0-2) ka koi landing point nahi
  hai, aur receivers/blocklists in addresses ke exist aur read hone
  ki umeed rakhte hain.
Sources: Spamhaus sender guidelines, Google mail sender guidelines.

## P1 — Day-1 docs me likhna hai, pehle hardening pass me implement ho sakta hai

**P1-1. Monitoring queue *age* aur delivery behaviour measure karegi,**
sirf "queue length" aur "process up" nahi. Deferred/stuck queue age,
top senders/recipients, rejected vs deferred split, auth-failure
rate, aur SMTP/IMAP/HTTPS ke liye alag-alag certificate expiry.
Chalta hua process jisme deferred queue badh rahi hai, phir bhi
outage hai. Alert channel mail service ke **bahar** hoga, taaki mail
outage apna alert khud na nigal jaye.

**P1-2. Blacklist coverage naam ke saath hogi,** sirf "MXToolbox"
nahi: Spamhaus ZEN/DBL, Spamcop, Barracuda, SORBS kam se kam, plus
usi check me PTR/SPF/DKIM/DMARC validation aur STARTTLS verification.
Delisting procedure: pehle cause fix karo, phir removal request
karo — kabhi wahi cause chalte hue removal request mat karo.

**P1-3. TLS policy explicit hogi:** MX par STARTTLS opportunistic
(MTA-STS/DANE enforcement layer hai), submission par TLS required
(opportunistic nahi), aur har service ke liye alag cert expiry alert.
Port 25 ya 993 par ek expired cert, web cert expire hone se alag
outage hai.

**P1-4. VPS-migration runbook me abort aur verification steps honge:**
MX TTL move se **pehle** kam karo (cutover par nahi), cutover ke
waqt queue pause karo, DKIM private key secure tareeke se transfer
karo (chat/email se kabhi nahi), cutover ke baad verification
checklist (inbound test, outbound test, DKIM/SPF/DMARC pass, PTR/
HELO match, purane host par queue drain zero), aur abort trigger
(kaun sa failure DNS ko purane host par wapas le jayega). Bina inke
"simple" VPS move silent deliverability outage ban jayega.

**P1-5. Staging kabhi prod reputation pollute nahi karegi:**
Staging sirf test inboxes ko bhejegi, kabhi real Gmail/Outlook users
ko nahi, aur staging IP/domain kabhi prod SPF/DKIM me add nahi
honge. Ek staging misconfiguration jo prod domain se bulk test mail
bhej de, prod reputation jala sakti hai.

**P1-6. Log retention, access control, clock sync ka rule hoga:**
Log retention period, logs (jinme addresses/metadata hain) kaun padh
sakta hai, Stalwart + APIs ke beech message trace karne ke liye
centralised log collection, aur NTP/time sync (DKIM, TLS, queue-
retry timestamps clock skew par toot jate hain). Ye P1 hai kyunki
launch block nahi karta, lekin pehle incident se pehle likha hona
chahiye, incident ke beech me nahi.

**P1-7. R2 blob lifecycle aur orphan handling ka rule hoga:**
Versioned-bucket lifecycle purane versions ke liye (cost control),
orphan blobs (jin ka data-store reference nahi hai) sirf scheduled
purge se delete honge, kabhi ad-hoc delete se nahi, aur R2 credential
rotation procedure (keys rotate karo, Stalwart restart karo, blob
reads verify karo — rotate karke assume mat karo).

**P1-8. BIMI aur ARC signing Day-1 nahi hain — ye decision record hoga:**
BIMI ko Verified Mark Certificate chahiye aur ye deliverability
requirement nahi hai; ARC signing forwarded mail ke liye tabhi
useful hai jab forwarding asli flow ho. Day-1 checklist me BIMI
mat add karo, ADR me deferred likh do taaki koi ise baad me aadha-
adhura na add kar de.
