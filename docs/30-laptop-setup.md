# 30 — Laptop setup (Windows 11 par backend test karna)

Status: DRAFT

Ye doc batata hai ki Windows 11 laptop par dusrel-backend (auth-api +
mail-api) kaise test karein. Laptop **test** ke liye hai; current deploy
target Orgo VM hai (laptop deploy target nahi hai).

## Chahiye hoga

- Node.js 24 (repo aur CI dono Node 24 par hain; `node -v` se 24.x
  aana chahiye)
- pnpm 12.16.1 (`pnpm -v` se 12.16.1 aana chahiye; repo ke
  `package.json` me `packageManager` field bhi yahi kehta hai —
  `corepack enable` karke ya `npm i -g pnpm@12.16.1` se milega)
- Git
- PowerShell (ya VS Code / Antigravity ka integrated terminal)

## Steps

Repo root se, PowerShell me:

```powershell
git clone https://github.com/dusmamud/dusrel-backend
cd dusrel-backend
# purane clone me clone ki jagah: git pull

pnpm install --frozen-lockfile
pnpm -r build
pnpm test
```

`pnpm test` se 4 suites chalti hain — auth-api 24, mail-api 12,
address 10, crypto 8, total **54/54**. Tests ke liye koi secret, DB ya
network nahi chahiye, kyunki runtime store abhi in-memory hai.

## Server chalana ho to (.env + --env-file)

Har service ke liye `.env.example` ko copy karke `.env` banao:

```powershell
copy services\auth-api\.env.example services\auth-api\.env
copy services\mail-api\.env.example services\mail-api\.env
```

JWT secret **dono files me SAME value** honi chahiye, warna mail-api
har token reject karega. Ek value banane ke liye (Node se hi):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Uski output ko dono `.env` files me `AUTH_JWT_SECRET` (auth-api wali)
aur `MAIL_JWT_SECRET` (mail-api wali) me daalo. Baaki values local
test ke liye example wali hi theek hain.

Phir **do alag terminals** me:

```powershell
cd services\auth-api
node --env-file=.env dist\src\index.js
```

```powershell
cd services\mail-api
node --env-file=.env dist\src\index.js
```

Health check:

- `http://localhost:3001/health` (auth-api)
- `http://localhost:3002/health` (mail-api)

Dono ka jawab `{"service":"auth-api"|"mail-api","status":"ok",
"version":"0.1.0"}` jaisa hona chahiye.

**Zaroori cheez:** sirf `pnpm start` se `.env` load **nahi** hoti —
code me koi dotenv nahi hai. `node --env-file=.env` zaroori hai.
Bina iske service dev default secret par chalegi aur warning
dikhegi (local test ke liye chal jayega, lekin secret daalna hi
behtar hai).

## Laptop par kya hoga, kya nahi hoga

Hoga:

- Poora test suite, build, lint (`pnpm lint`)
- Dono APIs ke health aur saare endpoints (mailboxes, messages,
  aliases, quota, settings, keys)
- Auth flows test-suite ke andar (login, TOTP, backup codes,
  app passwords, sessions, reset)

Nahi hoga:

- **Asli mail bhejna/receive karna.** Mail-api abhi fake JMAP
  (`InMemoryJmapClient`) par hai; asli Stalwart client + DNS
  (MX/DKIM/SPF/DMARC/PTR) + port 25 VPS step hai. Docker Desktop se
  compose stack locally dekh sakte ho, lekin real mail proof VPS
  par hi banega.
- **Restart par data bachna.** Store in-memory hai — server band
  hote hi sab data gaya. Postgres wiring ADR-004 ke faisle ke
  baad aayegi.
- **HTTP se pehla user banana (known v1 gap).** `/auth/invite/accept`
  endpoint hai, lekin invite-create HTTP par exposed nahi hai
  (sirf service-level function hai), aur `/admin/users` ko
  owner/admin token chahiye jabki khaali store me koi seed admin
  nahi hai. Isliye HTTP par login test karne ke liye user banane
  ka flow abhi test-suite (service layer) ke andar hi hota hai.
  Seed-owner / pehle-user bootstrap fix alag order par hoga.

## Troubleshooting

- **Port 3001/3002 pehle se busy ho:** kaun sa process hai, ye
  dekho — `netstat -ano | findstr :3001` — phir us process ko
  band karo, ya `.env` me `PORT` badal do (PORT env se hi aata
  hai, default 3001/3002).
- **Node version galat ho:** `node -v` se 24.x confirm karo.
  22 par bhi tests pass hue the (Orgo VM par verified), lekin
  repo ka target 24 hai.
- **pnpm version galat ho:** `pnpm -v` se 12.16.1 confirm karo.
  `package.json` ka `packageManager` field yahi maangta hai.
- **argon2 install par build maange:** aam taur par prebuilt
  binary download ho jaati hai. Agar compile karne lage to
  Visual Studio Build Tools (C++ workload) chahiye hoga.
- **Dev default secret warning dikhe:** matlab `.env` load nahi
  hui (ya JWT khaali hai) — `--env-file=.env` se chalao aur
  `.env` me JWT set karo.

## Verified scope (imaandari se)

Ye commands sandbox aur Orgo VM par verify hue hain (build pass,
tests 54/54, dono services health ok) — main @ `847a395`
(2026-10-31) par. Laptop par pehli baar chalane par result wahi
hona chahiye (Node 24 + pnpm 12.16.1 par); laptop ka apna pehla
run hi laptop-proof hoga.
