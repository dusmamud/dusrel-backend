# mail-server — Stalwart infra (VPS stack, v1 slice)

Asli mail server — SMTP bhejna/lena, IMAP/JMAP se mailbox
dikhana, DKIM/SPF/DMARC, spam filter.

Ye service koi Hono HTTP API nahi hai. Iska contract SMTP / IMAP /
JMAP protocol hai.

Choice: Stalwart (Rust, alag infra service, is repo ka app code nahi).
Image pinned hai: `stalwartlabs/stalwart:1.0.1` (31 Oct 2026 ko
verify kiya gaya latest release, 28 Oct 2026).

Deploy: VPS ONLY — Ubuntu VPS, Docker Compose.
Kabhi Workers, Pages ya Render ke mail kaam par nahi jayega.
Reason: Workers par general inbound TCP listener nahi hai, outbound
port 25 prohibited hai, dedicated IP / PTR nahi milta.

## Is folder me kya hai

- `docker-compose.yml` — poora VPS stack: Stalwart + Caddy +
  auth-api + mail-api. Ek hi file, taaki VPS badalne par wahi
  file + wahi env naye VPS par chal jaye.
- `Caddyfile` — sirf HTTP APIs ka reverse proxy + automatic HTTPS.
  SMTP/IMAP Caddy se proxy nahi hote.
- `.env.example` — sab env vars, placeholder values ke saath.
  Real `.env` kabhi Git me nahi jayega.

## Stalwart config ka sach (galat file mat likhna)

Stalwart v1 me koi hand-written `stalwart.toml` config file nahi
hai. First run par Stalwart khud `/opt/stalwart/etc/config.toml`
banata hai aur admin password `docker logs` me dikhata hai.
Asli settings (hostname, domain, storage, DKIM, listeners) WebUI
(127.0.0.1:8080, sirf VPS localhost se) se set hoti hain aur
Stalwart ke data store me rehti hain. Isliye is folder me koi
nakli config file nahi hai — jo file first run par banti hai,
wahi sach hai.

## VPS par first-run checklist (order me)

1. **Port 25 retest VPS par.** Pehla test orgo-desktop par tha —
   VPS ka proof nahi hai. VPS par outbound + inbound dono check
   karo, warna mail receive hi nahi hoga.
2. **DNS TTL 300s** pehle se set karo (docs/09, VPS badalne ka plan).
3. `cp .env.example .env` karke real values bharo (JWT secrets:
   `openssl rand -hex 32`). AUTH_JWT_SECRET aur MAIL_JWT_SECRET
   dono services me WAHI hona chahiye.
4. `docker compose up -d` chalao. `docker logs dusrel-stalwart`
   se admin password lo, **pehle login par turant badlo**.
5. WebUI > Server > Network me hostname set karo
   (example: `mail.dusrel.com` — final domain abhi lock nahi hua).
6. WebUI > Directory > Domains me domain add karo. Interface jo
   DNS records dikhaye (MX, DKIM TXT, SPF, DMARC), wahi DNS me
   dalo — docs/08 ka table usi se match karna chahiye
   (MX priority 10, SPF `v=spf1 mx -all`, DMARC pehle
   `p=quarantine` phir reports dekh kar `p=reject`).
7. WebUI > Storage > Blob Store me R2 set karo: S3-compatible,
   Custom region (endpoint `https://<account>.r2.cloudflarestorage.com`),
   bucket pehle se bana hua hona chahiye. **R2 ke liye
   `verifyAfterWrite: false`** rakho — R2 durability guarantee
   deta hai, isliye har write par HEAD check ki zaroorat nahi hai
   (Stalwart docs se verify kiya gaya hai). Data store default
   RocksDB hi rakho (Phase 1, single node).
8. DKIM: default signing expression sirf tab sign karta hai jab
   sender domain local ho aur client authenticated ho — yahi
   default sahi hai, isme chhed-chhad mat karo.
9. TLS ka faisla first run par WebUI me karo: Caddy sirf HTTP
   APIs (80/443) ke liye hai, isliye Stalwart ke IMAP/SMTP TLS
   ke liye ACME challenge aisa chuno jo Caddy se port na takraye
   (dns-01, agar tumhara DNS provider Stalwart ke ACME providers
   me supported hai) — warna certificate upload karo. Ye choice
   first run par verify karke lock karo, yahan andaze se nahi
   likhi gayi hai.
10. **Mail-tester proof:** mail-tester.com par test mail bhejo,
    score + SPF/DKIM/DMARC pass dekh kar hi Phase 1 ka ye item
    done mana jayega. Bina is proof ke "Stalwart chal gaya" ka
    claim mat karo.
11. **Abuse mailboxes banao:** `postmaster@` aur `abuse@` monitored
    inbound mailboxes (docs/23 P0-12) — bina inke complaint
    handling ka landing point hi nahi hai.

## Kya abhi bhi baaki hai (is slice me nahi hai)

- Stalwart ka asli VPS run + DNS + mail-tester proof (tumhare VPS
  par hoga, yahan sandbox me Docker hi nahi hai — isliye
  `docker compose config` tak verify nahi hua hai, sirf YAML
  syntax check hua hai).
- Provisioning sync: auth-api se Stalwart mailbox banana (doc 29
  ka atomic provisioning flow) — ye agla backend code slice hai,
  is compose me nahi hai.
- Backup script + monitoring (Uptime Kuma) — agla infra slice hai.
- Real Stalwart JMAP client mail-api me — Stalwart ke chalne ke
  baad hi verify hoga; tab tak mail-api ka fake hi rahega.
- DKIM private key, R2 keys, JWT secrets — kabhi Git me nahi.
