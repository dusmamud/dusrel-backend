# Architecture & Protocols Audit — Technical Verification Findings

Status: DRAFT — 2026-10-31  
Cross-Verification: Exa Search, Stalwart Official Docs, LiveKit Documentation, CockroachDB PostgreSQL Compatibility Specs, RFC 9788, OWASP Standards.

Is document me `docs/00` se lekar `docs/25` tak ka comprehensive, evidence-backed audit report darj hai. Ye document theoretical assumptions ko real-world protocol standards aur cloud constraints ke saath cross-verify karta hai.

---

## 1. Feasibility Scorecard

| Architectural Pillar | Docs Claims | Real-World Feasibility | Risk Level | Grounded Status / Blocker |
|---|---|---|---|---|
| **Stalwart + Cloudflare R2** | Zero state on VPS, Blobs in R2 | **High (Feasible with Config)** | 🟡 Medium | Stalwart native S3 backend R2 support karta hai, lekin no-WAL design ki wajah se R2 downtime par inbound SMTP immediate `451 4.3.5` throw karega. `verifyAfterWrite: false` optimize karna hoga. |
| **Cloudflare Pages Direct Upload** | Free plan unlimited builds via GitHub Actions | **High (Verified)** | 🟢 Low | `wrangler pages deploy` direct upload build minutes count nahi karta. Bypasses 500 builds/month limit. Hard limit: 20k files/deploy, 25MB/file. |
| **LiveKit SFU on VPS** | WebRTC video/audio on VPS Docker | **Feasible with Host Net** | 🔴 High | Docker Compose me 10,000 UDP ports (`50000-60000`) map karna iptables crash kar dega. `network_mode: host` + LiveKit UDP Mux (`7882`) mandatory hai. Port 443 Caddy ke sath conflict karega. |
| **CockroachDB + Drizzle** | Distributed SQL, multi-region ready | **High Architectural Risk** | 🔴 High | Free tier sunset ho chuka hai (Trial ke baad ~$203/mo standard). `SERIAL` key Raft write hotspots banata hai (UUID mandatory). Stalwart ka Cockroach advisory locks support verify karna mandatory hai. |
| **Client-Side E2EE (OpenPGP+BIP39)** | Zero-knowledge browser crypto | **Feasible with CSP Fix** | 🟡 Medium | Argon2id WebCrypto me natively exist nahi karta (WebAssembly required). Cloudflare Pages/Caddy CSP header me `'wasm-unsafe-eval'` mandatory hai, warna browser me key derive hi nahi hogi. |
| **Deliverability & VPS Migration** | 300s TTL rapid VPS switchover | **Flawed Assumption** | 🔴 High | A record TTL 300s hone ke baad bhi Reverse DNS (PTR) ISP resolvers par 12-48 ghante cache rehta hai. Naye VPS ka cold IP zero-reputation hone se outbound mail spam box ya drop hoga. |

---

## 2. Stalwart Mail Server + Cloudflare R2

1. **Native S3 Endpoint Compatibility:**
   Stalwart S3 storage driver Cloudflare R2 endpoint URL ko natively support karta hai:
   - Endpoint: `https://<account_id>.r2.cloudflarestorage.com`
   - Region: `auto`
   - Addressing: Path-style addressing default hai jo R2 ke sath compatible hai.
2. **Read-After-Write Redundancy:**
   Stalwart default me `verifyAfterWrite: true` rakhta hai, jisme har object write ke baad ek extra HTTP `HEAD` request bhej kar verify kiya jata hai. Cloudflare R2 natively strong read-after-write consistency provide karta hai. Isliye `verifyAfterWrite: false` set karna chahiye taaki Class B operations aur write latency 50% decrease ho sake.
3. **Absence of Local WAL (Write-Ahead-Log) for S3:**
   Stalwart me remote object storage ke liye local disk spool ya fallback queue nahi hoti. Agar Cloudflare R2 me connection timeout ya network hiccup aaye:
   - Inbound SMTP turant `451 4.3.5 Mail system storage error` dekar reject karega (sending MTA retry queue par rely karega).
   - Outbound webmail compose/drafts turant fail honge.
4. **SigV4 Compatibility Note:**
   Stalwart versions `< v0.16.26` me bodyless S3 `DELETE` requests (Purge blob store task ke dauran) Cloudflare R2 par `403 SignatureDoesNotMatch` throw karti thi. Docker image `stalwartlabs/mail-server:latest` ya `>= v0.16.26` pin karna mandatory hai.

---

## 3. Cloudflare Pages Direct Upload (GitHub Actions)

1. **Free Plan Build Limits Bypass:**
   Verified: GitHub Actions workflow me `wrangler pages deploy ./out --project-name=dusrel-web` run karne se Cloudflare Free Plan ka 500 builds/month limit bypass hota hai, kyunki build Cloudflare runners par nahi balki GitHub runners par hoti hai aur Cloudflare par direct assets upload hote hain.
2. **Hard Limits:**
   - 20,000 files per deployment max.
   - 25 MiB max file size.
   - 100 projects per account.
   - 1,200 API requests per 5-minute rolling window.
3. **One-Way Door & Action Deprecation:**
   - Direct Upload project ko Cloudflare native Git integration me revert nahi kiya ja sakta (project recreate karna padega).
   - Legacy `cloudflare/pages-action` deprecate ho chuki hai; workflow me `cloudflare/wrangler-action@v3` use karna mandatory hai.

---

## 4. LiveKit SFU on VPS (WebRTC & Docker Networking)

1. **Port Exhaustion in Bridge Mode:**
   `docs/09-deployment.md` me 10,000 UDP ports (`50000-60000/udp`) map karne ka plan Docker NAT/iptables ko crash kar dega.
   - **Remediation:** Docker Compose me `network_mode: host` use karein aur LiveKit ka single-port UDP Multiplexer (`rtc.udp_port: 7882`) use karein.
2. **Docker Bridge IP Leakage (ICE Candidates):**
   Host networking mode me LiveKit host ke saare network interfaces inspect karta hai aur Docker bridge IP (`172.17.0.1`) ko ICE candidate bana kar clients ko bhej deta hai, jisse remote users ka connection fail ho jata hai.
   - **Remediation:** LiveKit configuration me explicit exclude lagana mandatory hai:
     ```yaml
     rtc:
       ips:
         excludes:
           - "172.16.0.0/12"
           - "10.0.0.0/8"
     ```
3. **Port 443 Conflict (TURN-TLS vs Caddy HTTPS):**
   LiveKit ka built-in TURN/TLS port 443 mangta hai taaki strict corporate firewalls ko bypass kiya ja sake, jabki Caddy pehle se port 443 par HTTPS reverse proxy chala raha hoga.
   - **Remediation:** Caddy Layer 4 SNI proxy module (`caddy-l4`) use karein, ya LiveKit TURN ko standard port `5349` par fallback karein.

---

## 5. CockroachDB Cloud vs PostgreSQL

1. **Pricing & Free Tier Sunset:**
   CockroachDB Cloud ne permanent free tier band kar diya hai. 30-day trial ke baad Continuum Standard cluster $0.092/vCPU-hour + storage charge karega (~$203/mo for 2 vCPUs). Phase 1 me bootstrap ke liye standard managed PostgreSQL ($15-25/mo jaise Neon, Supabase, ya Hetzner VPS Postgres) ADR-004 ke mutabiq best choice hai.
2. **SERIAL vs UUID & Raft Bottlenecks:**
   CockroachDB me `SERIAL` actually non-sequential `unique_rowid()` hota hai. Drizzle ORM me sequence auto-increment use karne se distributed Raft write range hotspot bante hain. Database schema me strict `uuid("id").defaultRandom().primaryKey()` enforce karna hoga.
3. **Advisory Locks Limitation:**
   CockroachDB session-scoped PostgreSQL advisory locks (`pg_advisory_lock`) support nahi karta (wo silently no-op ho jate hain). Stalwart ka DB backend ya Drizzle migrations session locks par depend na karein, ye ensure karna zaroori hai.

---

## 6. Client-Side E2EE (OpenPGP, BIP39, Argon2id)

1. **WebCrypto vs WebAssembly for Argon2id:**
   Modern browsers ki native WebCrypto API Argon2id support nahi karti. Browser me Argon2id chalane ke liye WASM binary zaroori hai.
2. **Content-Security-Policy (CSP) Blocker:**
   Cloudflare Pages ya Caddy headers me strict CSP lagate waqt `'wasm-unsafe-eval'` script-src me hona mandatory hai. Agar ye miss hua, to browser WASM compile nahi karega aur E2EE seed key derivation fail ho jayegi.
3. **Draft Autosave Privacy Leak:**
   `docs/20-web-app.md` me draft autosave every 30s Stalwart IMAP/JMAP server par jata hai. E2EE mail compose ke waqt agar unencrypted draft server par gaya to zero-knowledge claim invalid ho jayega. E2EE mail ke drafts ko browser IndexedDB me local-only save karna hoga.

---

## 7. Dual-State Split-Brain (Stalwart DataStore vs CockroachDB)

1. **The Issue:**
   Stalwart mailboxes, message flags, aur UIDs ko apne internal DataStore (default local RocksDB) me manage karta hai.
   Agar Dusrel backend custom API alag se CockroachDB me metadata track karegi, to IMAP desktop clients aur webmail ke beech read-unread status aur message counts desynchronize ho jayenge.
2. **The Fix:**
   Webmail frontend ko direct Stalwart ke native **JMAP API** (`/jmap`) se baat karni chahiye. CockroachDB ko sirf Authentication, User Profiles, Aliases, aur Subscription metadata ke liye use karna chahiye.

---

## 8. Deliverability & Reverse DNS (PTR) Asymmetry

1. **PTR Propagation Lag:**
   A record TTL 300s rakhne se IP failover fast ho sakta hai, lekin VPS provider ka Reverse DNS (PTR) change global ISP resolvers (Google/Outlook/Yahoo) par 12-48 ghante cache rehta hai. Rapid failover par outbound mail FCrDNS fail ho kar reject ho jayega.
2. **Cold IP Reputation:**
   Naye VPS ka IP zero-reputation hota hai. Cutover ke waqt cold IP se high volume mail bhejne par IP turant spamhaus/blocklists me chali jayegi. Naye IP ko gradual warmup schedule se guzaarna zaroori hai.

---

## 9. Immediate Action Items

1. [ ] **JMAP Protocol Integration:** Webmail client me direct Stalwart JMAP client wire karein.
2. [ ] **UUID Schema Enforcement:** Drizzle schema me saare `serial()` primary keys ko `uuid()` se replace karein.
3. [ ] **LiveKit Host Networking:** `docker-compose.yml` me LiveKit container ko `network_mode: host` aur UDP Mux (`7882`) par set karein.
4. [ ] **CSP Header Update:** Web headers me `'wasm-unsafe-eval'` add karein taaki Argon2id WASM smoothly chale.
5. [ ] **Draft Autosave E2EE Guard:** E2EE compose mode me remote draft autosave disable karke IndexedDB local persistence enable karein.
