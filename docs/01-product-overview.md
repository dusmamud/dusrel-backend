# Product Overview — Dusrel Backend

Status: DRAFT — 2026-10-31

## Problem

Aaj ka user apna mail, files, chat aur meetings ke liye alag alag
companies par depend karta hai. Har company ka apna login, apni privacy
policy, aur apna data lock-in hota hai. Jo user apna data apne control
me rakhna chahta hai, uske paas koi ek suite nahi hai jo Proton jaisi
security aur Google jaisi suvidha dono de — apne domain aur apne server
par.

## Solution

Dusrel Backend ek hi backend foundation hai jisme:

- **Mail** — apne domain par secure mail, aliases ke saath, aur
  Atomic-style end-to-end encryption ke saath (jahan lagu hota hai)
- **Drive (future)** — apni files, sharing, R2 storage par
- **Chat (future)** — apni messaging, ek hi login se
- **Meet (future)** — apni video meetings, LiveKit par
- **Ek login** — ek baar login karo, saare apps khul jayein
- **Ek crypto layer** — seed phrase aur keys ka ek hi system, har app
  me dobara nahi banega

## Target user — Phase 1

1. **Primary:** Dusrel ka apna user (pehle khud + team) jo apne domain
   par mail chalana chahta hai, bina Gmail/Proton par depend hue.
2. **Secondary (baad me):** wo log jo apna data apne haath me rakhna
   chahte hain aur seed-phrase wali privacy samajhte hain.
3. **Abhi target nahi:** wo user jo password bhoolne par "forgot
   password" se account wapas chahta hai — E2EE me ye possible nahi hai
   (dekho `07-security-e2ee.md`). Aise user ke liye normal mail mode
   alag se sochna padega, E2EE mode me nahi.

## Dusrel Mail — Atomic Mail se kya lena hai, kya nahi

Atomic Mail (atomicmail.io/secure-email) se liye gaye ideas — uski
copy nahi, uske feature concepts:

- Seed phrase se account restore, bina phone ya dusri email ke
- Aliases se asli address chhupana
- TLS 1.3 default, internal mail par end-to-end encryption
- Bahar ke provider ko password-protected mail

Lekin Dusrel ka UI, branding, code aur implementation original hoga.
Kisi aur app ke assets, layout ya code ki copy nahi hogi.

## Kya Dusrel Backend nahi hai

- Ye sirf ek mail server install karne ka guide nahi hai — ye poore
  suite ka backend foundation hai.
- Ye Gmail ka clone nahi hai — Gmail jaisi suvidha, lekin apne
  control aur apni privacy ke saath.
- Ye "sab kuch free, unlimited" ka wada nahi hai — storage, mail
  sending aur Cockroach ki cost `03-trd.md` me saaf likhi hai.
- Ye E2EE ka jaadu nahi hai — subject, To/From aur date E2EE me bhi
  encrypt nahi hote, aur seed bhoolne par recovery nahi hai. Ye limits
  product page par bhi saaf likhni hongi, chhupani nahi.

## Success criteria — Phase 1 ko kamyab kab maanenge

Phase 1 tabhi kamyab hai jab ye sab ek saath sach ho:

1. `mail.dusrel.com` (example domain) par mail bhejna aur lena dono
   chalta hai, aur Gmail/Outlook par mail inbox me jata hai, spam me
   nahi (mail-tester par achha score ke saath).
2. Webmail se login, inbox, compose, reply, alias banana chalta hai.
3. VPS badalne par (dusre VPS par deploy karke) data dobara migrate
   nahi karna padta — Cockroach + R2 se wahi data mil jata hai.
4. Internal E2EE mail ka PGP round-trip test pass hota hai, aur seed
   recovery test pass hota hai.
5. Koi secret Git me nahi hai, aur backup restore ka test ek baar ho
   chuka hai.

Inme se ek bhi adhura ho to Phase 1 "done" nahi hai, chahe UI kitna
hi sundar kyu na lage.
