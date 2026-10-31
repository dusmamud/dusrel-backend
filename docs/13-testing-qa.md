# Testing & QA — launch se pehle kya pass hona hi chahiye

Status: DRAFT — 2026-10-31

## Rule

Koi feature "done" tabhi mana jayega jab uska test is doc me likha
ho aur pass ho. UI sundar hona test nahi hai. Screenshot test nahi
hai, jab tak uske peeche real behaviour na ho.

## P0 Test Checklist — Mail Phase 1

### Mail transport

- [ ] VPS par outbound port 25 test pass (dobara, VPS par hi)
- [ ] Inbound test: bahar se mail aata hai, inbox me dikhta hai
- [ ] Outbound test: Gmail + Outlook par mail inbox me jata hai
- [ ] Header check: `dkim=pass`, `spf=pass`, `dmarc=pass`
- [ ] mail-tester.com score — target user se lock hoga, bina target
  ke "achha score" ka dawa nahi karna
- [ ] PTR check: VPS IP -> mail hostname match karta hai
- [ ] Blacklist check: IP/domain kisi blacklist me nahi hai

### Auth aur account

- [ ] Login sahi password se chalta hai, galat se nahi
- [ ] TOTP 2FA on/off, galat code reject hota hai
- [ ] App password se IMAP login chalta hai, normal password revoke
  ke baad app password bhi kaam karna band ho jata hai (design
  lock ke hisaab se)
- [ ] Rate limit: lagatar galat login par block/delay lagta hai

### Mail app behaviour

- [ ] Compose -> send -> recipient inbox me milta hai
- [ ] Reply / reply-all / forward sahi thread me jata hai
- [ ] Alias se send hota hai, reply alias par wapas aata hai
- [ ] Attachment upload/download, size limit par sahi error aata hai
- [ ] Folder move, archive, trash, trash se restore chalta hai
- [ ] Spam mail spam folder me jata hai, normal mail spam me nahi

### E2EE (Phase 3 me, lekin test abhi se likha hai)

- [ ] PGP round-trip: A -> B encrypt, B decrypt, plaintext match
- [ ] Galat key se decrypt fail hota hai, silently plaintext nahi
  dikhta
- [ ] Seed recovery: naya browser me seed dalne par account aur
  purana E2EE mail wapas milta hai (jahan key backup design me hai)
- [ ] Seed loss test: seed ke bina E2EE mail nahi khulta — ye test
  pass hona hi chahiye, warna E2EE ka dawa jhootha hai
- [ ] Subject/headers encrypt nahi hote — UI me ye saaf dikhta hai

### Password-protected link

- [ ] Link + sahi password se mail khulta hai
- [ ] Galat password se nahi khulta
- [ ] Expiry ke baad link kaam nahi karta
- [ ] Revoke ke baad link kaam nahi karta

### VPS migration test

- [ ] Dusre VPS par deploy karke wahi Cockroach + R2 data milta hai
- [ ] DNS badalne ke baad mail bhejna/lena dobara chalta hai
- [ ] Purana VPS band karne ke baad koi data loss nahi hota

### Security test

- [ ] Koi API bina auth ke protected data nahi deti
- [ ] Ek user dusre user ka alias/key/file nahi dekh sakta
- [ ] Logs me body/key/password/token nahi milta (log sample check)
- [ ] Git me koi secret nahi hai (secret scan)

## Test types — code phase me

- Unit test: crypto helpers, validation, alias logic
- Integration test: API + DB + R2 (test bucket/schema par)
- E2E test: Playwright se webmail flow (login -> send -> receive)
- Manual test: real Gmail/Outlook inbox test — ye automated test
  se replace nahi hoga

## Bug rule

- P0 bug mila to release rukegi, chahe deadline kuch bhi ho.
- Security bug mila to pehle fix, phir feature.
- "Mere machine par chal raha hai" bug fix ka proof nahi hai —
  staging/prod jaisi environment par reproduce hona chahiye.
