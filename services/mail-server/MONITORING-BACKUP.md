# Monitoring + Backup runbook (v1 slice)

Ye doc VPS par chalane ke liye hai. Yahan sandbox me Docker nahi
hai, isliye ye config VPS par first run me verify karni hai —
"monitor lag gaya" ka claim sirf tab jab Uptime Kuma me monitors
green dikhen.

## Monitoring — Uptime Kuma (docker-compose.yml me hai)

Dashboard: VPS localhost par `http://127.0.0.1:3001` (public
nahi). Pehle login par admin account banao, phir ye monitors
banao (starting values, locks nahi):

| Monitor | Type | Target | Alert jab |
|---|---|---|---|
| auth-api health | HTTP | `https://auth.<domain>/health` | status != 200 ya 30s down |
| mail-api health | HTTP | `https://mail-api.<domain>/health` | status != 200 ya 30s down |
| SMTP inbound | TCP | `mail.<domain>:25` | port down |
| Submission | TCP | `mail.<domain>:587` | port down |
| IMAPS | TCP | `mail.<domain>:993` | port down |

Notification: Uptime Kuma ka notification channel **mail service
ke bahar** hona chahiye (docs/29 ka rule). Agar alert Dusrel
mail se hi jaye to mail down hote hi alert bhi band ho jayega.
VPS par lock karo: ntfy topic ya Telegram bot (koi bhi, bas mail
par depend na kare). Channel ka naam yahan andaze se nahi likha
gaya hai.

Host metrics (CPU/RAM/disk): Uptime Kuma host metrics nahi
dikhata — isliye disk ke liye `scripts/disk-alert.sh` hai (host
crontab se har 15 minute, threshold 80% — docs/14 ka rule).
CPU/RAM ka tool v1 me lock nahi hua hai (Netdata/Beszel jaise
options VPS par decide karo, yahan andaze se tool mat jodo).

Queue badh rahi ho to alert: v1 me automated queue alert nahi
hai — Stalwart WebUI > queue ko roz check karo. Automated queue
alert agle monitoring step me aayega (Stalwart queue metrics se).

Blacklist check: weekly manual (MXToolbox jaisi service se,
docs/14 + docs/08) — ye automated nahi hai.

## Backup — scripts/backup.sh

Schedule: roz 02:00, VPS host crontab se (starting value).
Order (Stalwart docs + docs/23 P0-9): **data store pehle, blob
store baad me, beech me koi purge nahi.** 04:00 wala daily blob
purge backup window se overlap nahi hona chahiye.

Script kya karta hai (order me):
1. Stalwart stop (downtime window — isliye 02:00 ka time hai).
2. `dusrel-mail_stalwart-data` volume ka tar (stopped server ki
   files consistent hoti hain; chal rahe store ki copy backup
   nahi hoti — Stalwart docs ka rule).
3. Stalwart wapas start (script fail ho tab bhi `trap` se start
   hota hai — mail down chhodna sabse bura hai).
4. R2 source bucket -> backup bucket sync (aws CLI, R2 endpoint).
5. Compose + Caddyfile (bina secret ke) backup folder me copy.
6. Retention: 7 din se purane backup folders delete (starting value).

Kya backup nahi hota: `.env` (secrets — Secure Vault me alag),
search index / in-memory store / cache (Stalwart dobara bana
leta hai), Cockroach managed backup (alag — Cloudflare/Cockroach
console se weekly verify karo, docs/14).

## Restore drill (docs/29 ka proposal, starting values)

Har 3 mahine me, isolated system (prod VPS nahi) par:
1. Latest backup tar + R2 backup bucket se restore karo.
2. Stalwart start karke login karo, ek purana message kholo.
3. Recovery time (restore shuru se login tak) runbook me likho.
Bina is drill ke backup ko "kaam karta hai" mat mano — backup
ka asli test restore hi hai (docs/14).

## Abhi bhi OPEN (is slice me nahi hai)

- Fail2ban: is stack me install nahi hai, isliye uska unblock
  path bhi nahi likha gaya hai (bina tool ke unblock procedure
  likhna fiction hota). Fail2ban install hone ke baad runbook me
  unblock path add hoga.
- Alert channel ka final naam (ntfy vs Telegram vs aur koi).
- CPU/RAM monitoring tool ka lock.
- Automated queue alert.
- Cockroach managed backup ka weekly verify — ye Cloudflare/
  Cockroach console ka kaam hai, is script ka nahi.
