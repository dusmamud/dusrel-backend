# Mail Deliverability — inbox me kaise pahuchega

Status: DRAFT — 2026-10-31

## Pehla sach — port 25 check (2026-10-31 ko user ne khud test kiya)

User ki machine `orgo-desktop` par test hua tha:

- UFW install ke baad `ufw status verbose` = inactive (local firewall
  block nahi kar raha)
- `ss -tlnp | grep ':25'` khaali tha — mail server abhi install nahi
  hai, ye expected hai, block nahi hai
- Outbound test `gmail-smtp-in.l.google.com:25` par do baar
  "Port 25 OPEN hai" aaya

Matlab: us machine se mail bhejne ka rasta khula hai. Lekin caveat
abhi bhi khula hai: hostname `orgo-desktop` local desktop jaisa lagta
hai, VPS jaisa nahi. Agar test local PC par hua tha to VPS par yehi
test dobara karna padega. Mail server install se pehle VPS par ye
test dobara confirm karna hai — bina iske deliverability ka dawa
nahi karna.

## DNS checklist — mail server se pehle ye sab lagna hai

| Record | Kya hoga | Kahan set hoga |
|---|---|---|
| A | mail.dusrel.com -> VPS IP (example domain) | Domain DNS |
| MX | dusrel.com -> mail.dusrel.com, priority 10 | Domain DNS |
| SPF TXT | `v=spf1 mx -all` jaisa, sirf allowed sender | Domain DNS |
| DKIM TXT | Stalwart se generated public key | Domain DNS |
| DMARC TXT | Pehle `p=quarantine`, reports dekh kar `p=reject` | Domain DNS |
| PTR / rDNS | VPS IP -> mail.dusrel.com | VPS provider panel se, DNS se nahi |
| MTA-STS | Policy + TXT | Baad me, deliverability badhane ke liye |
| TLS-RPT | Reports ka address | Baad me |

Rules:

- DKIM signing domain (`d=` tag) aur From domain same hone chahiye,
  warna DMARC fail hoga chahe SPF aur DKIM alag alag pass ho jayein.
- Cloudflare DNS use karo to mail records par proxy OFF rakho
  (grey cloud), warna SMTP toot jayega.
- SPF me seedha IP likhne se behtar `mx` use karo, taaki VPS
  badalne par SPF dobara na badalna pade.

## Stalwart ke built-in kaam

Stalwart me ye built-in hai, alag se lagane ki zaroorat nahi hai
(verify kiya gaya hai uske docs se):

- DKIM sign + verify (v1/v2), SPF verify, DMARC, ARC
- Spam filter, DNSBL, greylisting, phishing protection
- ACME se auto TLS certificate
- DKIM key auto rotation

Alag se Rspamd / OpenDKIM lagana Phase 1 me zaroori nahi hai.
Agar baad me virus scan chahiye to ClamAV alag se evaluate hoga.

## IP reputation — naye IP ka sach

- Naya VPS IP zero reputation se shuru hota hai. Pehle Gmail/Outlook
  thoda strict hoga, ye normal hai.
- Warmup: pehle kam mail, dheere dheere badhao. Ek din me hazaron
  mail mat bhejo naye IP se.
- Bounce aur spam complaint par turant action lo, warna IP
  blacklist ho jayega.
- Blacklist check: launch se pehle aur har hafte MXToolbox jaisi
  check se IP/domain ki list dekhni hai (operations doc me).

## Testing — inbox ka proof

- mail-tester.com par score check — launch se pehle target score
  user se lock hoga, guess karke number mat likhna.
- Gmail, Outlook, Yahoo (agar possible ho) par test mail bhejo aur
  dekho: inbox ya spam? Header me `dkim=pass`, `spf=pass`,
  `dmarc=pass` dikhna chahiye.
- Bina is test ke "mail deliverability ho gayi" ka dawa nahi karna.
