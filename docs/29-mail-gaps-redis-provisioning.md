# Mail Gaps — Redis Decision, Account Provisioning, Address/Quota Rules

Status: DRAFT — 2026-10-31
Source: Exa-verified gap report (2026-10-31, Exa Search API route se —
REST connector, MCP server nahi) + maujooda docs ka grep.
Sources: Stalwart official docs (Redis + in-memory store pages),
Postgres vs Redis decision guide, Gmail sender guidelines, self-hosted
mail checklists, mailbox provisioning guides.

Ye doc `docs/21` (user flows), `docs/23` (infra/deliverability),
`docs/26` (architecture audit) aur `docs/27`/`docs/28` ko replace
nahi karta — ye un docs me mile gaps ko bharta hai, khaas karke:
Redis ka decision (docs me zero mention tha), account creation ka
atomic provisioning flow (F1 me sirf "admin banata hai" tha),
address/quota ke rules, plus-addressing, multi-domain rule, aur
"and all kya kya chahiye" wali needs list ka status.

**Numbers ka note:** Is doc me diye numbers starting proposals hain,
final locks nahi — code phase se pehle R2 budget, VPS disk aur Stalwart
defaults check karke lock karne honge. Jahan decision open hai, wahan
saaf `OPEN` likha hai. Is doc se ADR-004 (Cockroach vs Postgres)
close nahi hota, aur stack ka PROPOSED status bhi nahi badalta.

## 1. Redis — Phase 1 me nahi chahiye, future trigger saaf hai

### 1.1 Stalwart ke liye verdict (official docs se verify hua)

- Stalwart ka Default in-memory store single node ka default hai, koi
  config nahi chahiye, 1,048,576 entries tak rakhta hai, full hone
  par counters pehle evict hote hain, locks kabhi evict nahi hote.
  Ye store rate-limit counters, greylisting entries, locks aur
  short-lived tokens rakhta hai.
- **Redis sirf tab zaroori hai jab cluster ho, ya single node ko
  restart ke baad bhi state bachani ho.** Cluster me nodes ko
  rate-limit counters aur locks share karne hote hain, aur local
  process-memory store wo nahi de sakta — isliye coordinator ke
  saath Default store use karna Stalwart mana kar deta hai.
- **Redis data store, blob store ya search store kabhi nahi ban
  sakta** — wo sirf in-memory store, cluster coordinator aur
  cache-swap snapshots ke liye hai. Matlab Redis se mail store ya
  R2 ki jagah nahi li ja sakti.

### 1.2 DRAFT decision — Phase 1

- **Phase 1 me Redis/Valkey nahi jodega:** Single VPS, single
  Stalwart node, single API instance. Stalwart Default in-memory
  store + Cockroach (app metadata) + in-memory app counters kaafi
  hain. Redis jodne ka matlab ek aur service operate/backup/monitor
  karni padegi, bina zaroorat ke — isliye Phase 1 me isko mat jodo.
- **Phase 1 ki limits (ye limits docs me likhni zaroori hain, warna
  baad me surprise hoga):** Restart par in-memory counters reset ho
  jayenge (rate-limit counters, greylisting entries, short-lived
  tokens). Har API instance ka apna alag limit hoga — Phase 1 me
  instance ek hi hai, isliye ye limit abhi dikhegi nahi, lekin
  scaling ke waqt ye assumption toot jayegi.
- **Future trigger (kab Redis/Valkey aayega):** Jab Stalwart cluster
  ya multi-instance API aayega, tab **Valkey** (Redis ka open-source
  fork, Stalwart docs me bhi Valkey naam se hai) in-memory store +
  coordinator ke liye aayega. Us waqt Redis ka `maxmemory` policy
  choose karni hogi, kyunki Stalwart startup par usko check nahi
  karta — galat policy par memory pressure me critical keys evict
  ho sakti hain (session keys evict hui to random logout lottery
  ban jayegi).

### 1.3 App backend ke liye Redis kab chahiye — decision rule

Postgres vs Redis decision guide se:

- Jo data khona acceptable hai (dobara ban sakta hai) uske liye
  Redis achha hai; jo khona acceptable nahi hai (audit,
  entitlement, roles) uske liye Cockroach/Postgres sahi hai.
- Atomic increments/high-rate counters ke liye Redis jeetta hai;
  audit/query/backfill ke liye Postgres jeetta hai.
- Session revocation ke liye hybrid model (signed token + server-side
  revocation list) me Redis strong hai, lekin eviction ka khatra
  upar wale point me hai.

Is rule se Dusrel ke liye:

| Kaam | Phase 1 me kahan hoga | Future me kahan jayega |
|---|---|---|
| Stalwart rate-limit/greylisting/locks | Stalwart Default in-memory store | Valkey (cluster trigger par) |
| App rate-limit counters | App in-memory (single instance) | Valkey, jab multi-instance API aayega |
| OTP attempt counters | Cockroach/app DB (audit ke liye, khona acceptable nahi) | Wahi rahega — Redis me mat dalo |
| Refresh-token revocation list | Cockroach/app DB (revocation khona matlab revoked access wapas mil jayega — ye acceptable nahi hai) | Wahi rahega, ya hybrid: Redis cache + DB source of truth |
| Mail queue | Stalwart ki apni SMTP queue (VPS) | Wahi rahega |
| App background jobs (welcome mail, cleanup, notifications) | App DB queue table (durable, audit ke liye) — alag job queue service Phase 1 me nahi chahiye | Load badhne par dedicated queue evaluate hogi, tab alag ADR banega |

## 2. Account creation ka atomic provisioning flow

`docs/21` F1 me sirf ye tha: admin user banata hai, mailbox + quota
set karta hai, invite milta hai. Dual-write ka rule nahi tha — ye
section wo gap bharta hai.

### 2.1 Steps — order matter karta hai

1. **Validate karo:** Address rules (Section 3) + reserved names
   (`docs/27` Section 7, `docs/28` Section 4) + domain ka owner hona
   + quota/limits ke andar hona. Fail hua to kuch mat banao, saaf
   error do.
2. **Idempotency key lo:** Har create request ke saath ek idempotency
   key hogi (client/admin dashboard se UUID). Retry par wahi key
   aayi to dobara mailbox nahi banega — pehle wali response wapas
   milegi. Ye provisioning best practice hai, taaki network retry
   par duplicate account na bane.
3. **Cockroach me user row banao — status `provisioning` ke saath:**
   User tab tak `active` nahi mana jayega jab tak Stalwart mailbox
   confirm na ho jaye. Isse aadha-bana account login nahi kar
   payega.
4. **Stalwart me mailbox banao:** Stalwart ke apne admin/API rasta
   se (exact API call code phase me lock hogi). Stalwart mailbox
   banne par uska mailbox ID Cockroach row me store karo.
5. **Confirm karo:** Dono taraf se mailbox exist karta hai, ye check
   karke status `provisioning` se `active` (ya invite-pending, F1 ke
   hisaab se) karo. Tabhi invite bhejo (F1 ka step 2).
6. **Status poll karo:** Agar creation async hai to caller status
   poll karega — `provisioning` → `active` ya `failed`. `failed`
   par saaf reason milega, chhupa hua error nahi.

### 2.2 Failure matrix — har fail par kya hoga

| Fail kahan hua | Kya hoga |
|---|---|
| Validation fail | Kuch nahi banega, saaf error |
| Cockroach row ban gayi, Stalwart fail ho gaya | Cockroach row `failed` mark hogi, retry par wahi idempotency key se dobara Stalwart create hoga — duplicate row nahi banegi. Operator ko alert jayega, user ko "account ban raha hai" ka jhootha message nahi milega |
| Stalwart mailbox ban gaya, Cockroach confirm fail ho gaya | Stalwart mailbox orphan na rahe — compensation job usko delete ya `provisioning` state me rok kar operator review me dalegi. Orphan mailbox ka periodic reconciliation job chalega (schedule code phase me lock hoga) |
| Invite bhejte waqt fail ho gaya | Account `active`/`invite-pending` hi rahega, invite dobara bhejne ka rule F1 wala hai (single-use, expiry, admin dobara bhejega) |

### 2.3 Split-brain rule — ye rule pehle docs me nahi tha

Stalwart ka internal DataStore (default RocksDB) mailbox flags,
UIDs, counts aur mailbox state ka source of truth hai — ye baat
`docs/26` me bhi note hui thi ki docs me iska mention hi nahi hai.
Ab ye DRAFT implementation rule hai:

- **Webmail/API Stalwart ke native JMAP se baat karega** mailbox
  data ke liye. Cockroach me sirf auth/profiles/aliases/subscription
  metadata rahega.
- **Cockroach me mailbox flags/counts/UIDs duplicate-track mat
  karo.** Agar dono jagah count rakha to wo alag ho jayega
  (split-brain) aur user ko galat unread count dikhega. Jo data
  Stalwart ka hai, wo Stalwart se hi padha jayega.
- **Cockroach me sirf ye rahega:** User identity, roles, aliases
  (address list), quota setting, secondary recovery email (verify
  status ke saath), public keys directory, seed-encrypted private-key
  backup (Phase 3), subscription/billing metadata (Phase 4 ke baad).
  Mail bodies, attachments, flags, folders ka content Cockroach me
  kabhi nahi jayega — wo Stalwart + R2 me hai.

## 3. Address / username ke rules (DRAFT proposals)

Ye rules DRAFT proposals hain — code se pehle inko final lock karna
hoga, lekin bina rules ke account creation test hi nahi ho sakta,
isliye ye proposals likhe ja rahe hain:

- **Format (starting proposal):** Local-part lowercase hi store hoga
  (user capital letters dale to bhi lowercase me convert hoga, taaki
  `Arav@` aur `arav@` do alag account na ban jayen). Allowed
  characters: `a-z`, `0-9`, `.`, `_`, `-`. Length: kam se kam 3,
  zyada se zyada 64 (RFC local-part limit). Shuru ya aakhir me dot
  nahi hoga, aur do dots lagatar nahi honge.
- **Reserved names:** `postmaster`, `abuse`, `support`, `admin`,
  `security` jaise system addresses + pehle se use hui addresses
  kabhi naye user ko nahi milenge. Ye rule admin-creation par bhi
  utna hi lagu hai jitna public signup par (`docs/27` Section 7).
  Deleted address kabhi recycle nahi hoga (`docs/28` Section 4).
- **Display name:** User ka display name alag field hai, address se
  alag hai. Display name me koi bhi printable characters ho sakte
  hain, lekin usse login nahi hoga — login hamesha poore address ya
  username se hoga.
- **Case + dots ka rule code me test hoga:** `docs/13` me ye tests
  add karne hain — uppercase input lowercase me convert hota hai,
  invalid characters reject hote hain, reserved name reject hota
  hai, duplicate address (case-insensitive) reject hota hai.

## 4. Default quota + limits (starting proposals, lock nahi)

| Limit | Starting proposal | Final lock kis par depend karega |
|---|---|---|
| Default mailbox quota per user | 5 GB | R2 budget + VPS disk se |
| Alias limit per user | 10 | Abuse risk se (alias factory banne se bachna hai, `docs/22` me ye risk pehle se hai) |
| Attachment size per mail | 25 MB | Stalwart + R2 + recipient limits se |
| Message size (total) | 25 MB (attachment samet) | Upar wale se |
| Daily send limit (normal user) | `docs/22` ke outbound caps ke saath align hoga (500/hour starting proposal) — storage quota se alag hai, confuse mat karo | Outbound reputation se |

Quota-full flow `docs/21`/`docs/25` me pehle se hai (inbound reject
ya queue, send block error, 80%/90% warning) — is doc se wo flow
nahi badalta, sirf default numbers propose hue hain.

## 5. Plus-addressing — DRAFT recommendation (final lock pending)

`docs/21`/`docs/25` me ye decision OPEN tha. Ab DRAFT recommendation
ye hai (final lock code se pehle hoga):

- **Plus-addressing ON hoga, lekin plus alag identity nahi banega:**
  `name+shop@domain` ka mail `name@domain` ke mailbox me deliver
  hoga, usi folder rules ke saath. Plus se login nahi hoga — login
  hamesha base address se hoga.
- **Plus se signup nahi hoga:** Naya account hamesha base address se
  banega, plus address se account creation reject hoga.
- **Catch-all OFF hi rahega** (PRD me pehle se hai) — plus ON hone
  ka matlab catch-all ON nahi hai, ye dono alag cheezein hain.
- **Final lock pending hai:** Agar user chahe ki plus ko alag
  identity mana jaye (jaise true alias), to ye recommendation badal
  jayegi aur uske liye alag ADR banega.

## 6. Multi-domain rule — Phase 1 me single domain only (DRAFT)

- Phase 1 me sirf ek domain hoga (docs me example `dusrel.com` /
  `mail.dusrel.com` — final domain/hostnames abhi bhi example hain,
  lock nahi hue hain).
- User apna domain la sakta hai ya nahi, multiple domains honge ya
  nahi — ye Phase 1 ka sawaal nahi hai, future ka decision hai.
  Phase 1 ke liye "single domain only" DRAFT rule hai, taaki code
  me domain ko har jagah variable banane ki zaroorat na pade, lekin
  domain ka naam ek jagah se configurable hoga (hardcode nahi hoga).

## 7. Stalwart-on-Cockroach test — ADR-004 se pehle mandatory hai

Ye test `docs/23` P0-10 aur `docs/26` me pehle se OPEN hai, is doc
se wo close nahi hota — sirf test ke steps saaf likhe ja rahe hain:

1. **Advisory lock test:** Cockroach me `pg_advisory_lock` session
   lock ka test karo — Stalwart docs ke hisaab se Cockroach isko
   support nahi karta (silently no-op ho jata hai). Agar Stalwart ya
   Drizzle migrations session locks par depend karte hain to wo
   dependency hatani hogi, warna lock ka bharosa jhootha hoga.
2. **`40001`/`40003` retry test:** SERIALIZABLE transaction me
   serialization failure (`40001`) aur deadlock (`40003`) par retry
   logic ka test karo — retry ke bina concurrent writes fail honge.
3. **UUID schema enforcement test:** Schema me
   `uuid("id").defaultRandom().primaryKey()` enforce karo — `SERIAL`
   Cockroach me Raft write hotspot banata hai (`docs/26` me pehle se
   hai).
4. **Ye test pass hone ke baad hi ADR-004 decide hoga:** Cockroach
   rahega ya cheaper Postgres aayega. Test fail hua to Stalwart ka
   store Cockroach nahi hoga — ye faisla test ke baad hoga, pehle
   nahi.

## 8. Queue, backup restore drill, monitoring — jo saaf nahi tha

- **Queue-expiry / DSN timing (numbers OPEN hain):** Queue-expiry
  aur DSN delay-notification timing ke numbers is doc me lock nahi
  hue hain — code phase se pehle Stalwart defaults check karke lock
  karne honge. Procedure rule ye hai: maintenance ke liye operator
  queue pause kar sakta hai, resume par retry schedule wahi rahega,
  mail drop karke nahi hoga (deferral `452` se hoga, ye `docs/22`
  me pehle se hai).
- **Backup restore drill (starting proposal):** Backup order
  `docs/23` me hai (data store pehle, blob store baad me, beech me
  purge nahi), lekin restore drill ka schedule saaf nahi tha. Ab
  DRAFT proposal ye hai: har 3 mahine me isolated system par restore
  drill hogi — account login + message retrieval verify hoga, aur
  recovery time record hoga. Drill ka result runbook me darj hoga.
- **Monitoring / alert channel (rule + OPEN choice):** Critical
  alerts usi mail service ke bahar wale channel par jane chahiye —
  agar mail service hi down hai to usi se alert nahi aayega. Kaun
  sa bahar wala channel hoga (admin ka personal email/phone ya koi
  aur tool), ye Phase 1 setup me lock hoga, is doc me channel ka
  naam nahi likha gaya hai. Tool lock bhi pending hai: runbook me
  Uptime Kuma ka ek line mention hai, lekin Prometheus/Grafana/log
  centralisation ka faisla abhi nahi hua hai.
- **Fail2ban unblock path:** `docs/25` me checklist item hai
  ("documented unblock path"), lekin actual path is doc me bhi nahi
  likha gaya hai — ye runbook me likhna baaki hai, taaki legitimate
  user galti se block hua to operator usko kaise kholega, ye saaf ho.

## 9. Future features — Phase 1 me nahi aayenge (galat mat samajhna)

- **Import from Gmail / other provider:** PRD me non-goal (N3) hai —
  Phase 1 me nahi aayega. Future me aayega to E2EE mail import
  plaintext na ho, ye warning `docs/24` me pehle se hai.
- **Client settings guides:** Thunderbird/Apple Mail/FairEmail ke
  liye server settings (host, ports 587/465/993, TLS) ka user-facing
  doc backend docs me nahi hai — ye web help me jayega ya backend
  docs me, ye decide karna baaki hai. App passwords `docs/21` F6 me
  hain, settings guide alag cheez hai.
- **Sieve visual builder, vacation responder, scheduled send / undo
  send, search polish:** Roadmap Phase 2 me hain, Phase 1 me nahi.
  Sieve ka zikr PRD/roadmap me hai, visual builder ka flow
  `docs/21` me ek line me hai — poora flow Phase 2 design me banega.
- **ClamAV decision OPEN hai:** Plaintext mail scan hoga ya nahi,
  E2EE mail skip hoga ya nahi — ye final rule abhi nahi likha gaya
  hai (`docs/08` me "baad me evaluate hoga" hai, `docs/22`/`docs/24`
  me E2EE conflict hai).

## 10. Needs list — "and all kya kya chahiye" ka status

| Chahiye | Status |
|---|---|
| VPS (Ubuntu, static IP, PTR, port 25) | Docs me hai — VPS par port 25 retest pending hai (`orgo-desktop` wala test VPS ka proof nahi hai) |
| Domain + DNS (A/MX/SPF/DKIM 2048/DMARC/MTA-STS/TLS-RPT) | Docs me hai — final domain/hostnames abhi bhi example hain |
| Stalwart (VPS-only) | Docs me hai |
| Cockroach Cloud ya cheaper Postgres | ADR-004 OPEN — Section 7 ka test pehle hoga |
| R2 blobs | Docs me hai |
| Caddy + Let's Encrypt, Docker Compose | Docs me hai |
| Turnstile | Docs me hai (`docs/22`, `docs/27`) |
| Postmaster Tools + DMARC/TLS report mailboxes | Docs me hai (`docs/23`) |
| Backup storage + restore drill | Order docs me hai, drill schedule is doc Section 8 me propose hua hai |
| Monitoring (Uptime Kuma mention, queue/disk/5xx alerts) | Partial — tool lock + bahar wala alert channel OPEN hai |
| Fail2ban / Stalwart auto-block | Rule docs me hai, unblock path runbook me likhna baaki hai |
| Redis / Valkey | Phase 1 me nahi — Section 1 ka decision + trigger is doc me hai |
| ClamAV | Decision OPEN hai |
| Admin dashboard (alag Next.js project, future) | `docs/28` me hai — repo naam/Phase OPEN hai |
| Support channel (admin reset/appeal ke liye) | OPEN hai (`docs/27` Section 10, `docs/28` Section 8) |
| Terms/privacy/abuse policy content | Phase 4 public signup se pehle chahiye — content nahi likha hai |
| Client settings guides, import tool | Future — Phase 1 me nahi |

## 11. Abhi bhi OPEN — is doc se close nahi hue

1. ADR-004 (Cockroach vs Postgres) — Section 7 ka test pehle hoga.
2. Saare numbers: default quota (5 GB proposal), alias limit (10
   proposal), attachment/message size (25 MB proposal), queue-expiry/
   DSN timing, invite expiry, rate-limit final numbers, admin session
   timeout, appeal deadline, purge window — sab code phase se pehle
   lock hone chahiye.
3. Plus-addressing ka final lock (Section 5 DRAFT recommendation
   hai, final nahi).
4. Final domain/hostnames (docs me abhi bhi example hain).
5. App-password revoke contradiction (`docs/13` vs `docs/21`/`docs/25`)
   — is doc se close nahi hua hai.
6. Refresh-token storage lock, exact PGP library per platform, sync
   conflict rule, key rotation procedure, seed QR mitigation, JMAP
   primary wording — ye pehle se open the, is doc se bhi close nahi
   hue hain.
7. `docs/13-testing-qa.md` me is doc ke tests abhi add karne hain —
   is doc me sirf rules likhe hain, test cases nahi badle gaye hain.
   Add karne wali tests: provisioning atomicity test (har failure
   matrix row), idempotency retry test (duplicate nahi banega),
   split-brain test (Cockroach me flags/counts duplicate-track nahi
   hote), address validation test (lowercase, invalid chars,
   reserved, duplicate case-insensitive), quota-limit test, plus-
   addressing delivery test, Stalwart-Cockroach advisory-lock +
   retry + UUID test, restore drill test, Redis-not-required test
   (single node Default store se chalta hai).

## Cross-references

- `docs/21-mail-core-user-flows.md` F1, F2 — admin invite aur
  onboarding ka base, ye doc unka extension hai.
- `docs/22-mail-core-security-bot-ddos.md` — outbound caps, Turnstile,
  auto-suspend sending only, fail2ban rule.
- `docs/23-mail-core-infra-deliverability.md` — backup order,
  queue-expiry gap (P0-3), Cockroach test (P0-10), DMARC/TLS reports.
- `docs/25-mail-core-day1-checklist.md` — quota-full flow, plus-
  addressing decision, compromised containment.
- `docs/26-architecture-audit-findings.md` — Stalwart internal store
  ka mention na hona, UUID hotspot, SERIAL rule.
- `docs/27-account-signup-recovery.md` — secondary recovery email,
  OTP sender (Section 11), reserved names.
- `docs/28-admin-dashboard-moderation.md` — account states, spam
  lifecycle, appeal, dashboard scope.
- `docs/06-database-design.md` — alias_address unique; is doc ke
  address/quota rules us schema ke saath align hone chahiye.
- ADR-002, ADR-004, ADR-009 (`docs/12-decisions-adr.md`) — v1
  TypeScript only, Cockroach vs Postgres OPEN, public signup Phase 4
  tak nahi; is doc se koi ADR close nahi hota.
