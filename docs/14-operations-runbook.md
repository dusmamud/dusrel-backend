# Operations Runbook — backup, monitoring, outage

Status: DRAFT — 2026-10-31

## Daily / Weekly routine (launch ke baad)

- Daily: mail queue check (Stalwart), error logs ka ek nazar, disk
  usage check.
- Weekly: blacklist check (IP/domain), backup ka ek sample check,
  Cockroach usage + cost check, R2 usage + cost check.
- Monthly: DKIM rotation check (Stalwart auto hai, phir bhi verify),
  dependency audit, access review (kaun admin hai, kaun nahi).

## Backup

- Cockroach: managed backup on hai ya nahi, har hafte verify karo.
- R2: versioning on hai ya nahi, har hafte verify karo.
- Stalwart config: Git me hai (bina secret ke), har change ke baad
  commit hai ya nahi, check karo.
- Backup ka asli test restore hai: har mahine ek baar test
  environment par restore karke dekho. Bina restore test ke backup
  ko "hai" mat mano.

## Monitoring — kya dekhna hai

- VPS: CPU, RAM, disk, uptime (Uptime Kuma ya aisa tool)
- Stalwart: queue length, bounce rate, SMTP errors
- APIs: 5xx rate, latency p95, rate limit hits
- Cockroach: connections, storage, cost
- R2: storage, operations, cost
- Alert: queue badh rahi ho, disk 80% se upar ho, API 5xx badh
  rahe hon — to turant dekhna hai, agle din par mat chhodna.

## Outage playbook — kya tootega to pehle kya karna hai

### VPS down

1. VPS provider ka status dekho — provider down hai ya sirf tumhara
   VPS?
2. VPS restart karo, Docker services ka status dekho.
3. Agar VPS wapas nahi aata to dusre VPS par deploy karo (dekho
   `09-deployment.md` VPS badalna wala section). Data Cockroach +
   R2 me hai, isliye data loss nahi hona chahiye.
4. DNS/PTR check karo, phir mail test bhejo.

### Cockroach down / slow

1. Cockroach Cloud dashboard dekho — region, connections, cost limit
   to nahi lagi?
2. API ko read-only mode me mat dalo bina soche — pehle ye dekho ki
   kaun si service sabse zyada query maar rahi hai.
3. IP allowlist check karo — naya VPS IP add hai ya nahi?

### R2 down / slow

1. Cloudflare status dekho.
2. Stalwart queue dekho — sender retry karega, isliye turant data
   loss ka dar nahi hai, lekin naye mail ki body store nahi hogi.
3. R2 keys expire to nahi hui? Env check karo, Git me key mat
   dhoondhna.

### Mail spam me ja raha hai

1. Pehle header check karo: SPF/DKIM/DMARC me se kya fail ho raha
   hai?
2. IP blacklist check karo.
3. PTR aur From/DKIM domain alignment check karo.
4. Warmup todna mat — ek din me bulk mail mat bhejo, reputation
   aur kharab hogi.

## Incident rule

- Incident me pehle user ko sach batao: kya toota hai, kya data
  safe hai, kya nahi hai. "Sab theek hai" jab tak theek na ho,
  mat bolo.
- Incident ke baad ek chhota note likho: kya hua, kyu hua, dobara
  na ho iske liye kya badla. Ye note `docs/` me nahi, operations
  log me jayega — abhi operations log ka format baad me lock hoga.
- Secret leak hua to pehle key rotate karo, phir investigation karo.
  Leak hui key ko "shayad koi use nahi karega" maan kar mat chhodna.
