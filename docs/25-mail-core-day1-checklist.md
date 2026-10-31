# Mail Core — Day-1 Checklist (Master, Deduplicated)

Status: DRAFT — 2026-10-31
Source: Docs 21–24 ka consolidated checklist. Har subagent ne apni
15-item list di thi — yahan overlap hata diya gaya hai, taaki ek
hi cheez do jagah na gini jaye. Jo item yahan hai, wo Mail Phase 1
ke build se pehle decide/lock hona chahiye. "Baad me" is checklist
ki koi item ke liye valid jawab nahi hai, jab tak wo item P1 section
me na ho.

## Gate rule

Mail Phase 1 ka build tabhi shuru hoga jab neeche wale P0 items ke
rules likhe hue hon — numbers jahan proposal hain, wahan final lock
code phase se pehle hoga, lekin rule ka shape (kya hoga, kis par
lagega, fail hone par kya dikhega) Day 1 se likha hoga. Tester ko
har P0 item ke liye ek test case milna chahiye (`13-testing-qa.md`
me add hoga).

## A. User flows — Day 1 (source: doc 21)

1. **Normal account forgot-password flow:** no-enumeration message,
   single-use expiry token, session invalidation, reset notification.
   E2EE seed is flow se unlock nahi hoga — ye UI me saaf hoga.
2. **2FA recovery:** setup par backup codes, phone kho jaane par MFA
   reset + re-auth + notification.
3. **Session lifecycle:** expiry UX, idle timeout, sign-out-all-devices,
   device/IP list + single revoke.
4. **Admin-invite / first-password-set flow:** invite expiry, beech
   me chhodne par kya hoga, dobara invite ka rule.
5. **Compose failure + draft queue:** send fail par draft bache +
   retry, offline draft queue, do-device draft conflict rule.
6. **From/identity picker:** default + last-used identity, alias reply
   auto-fill.
7. **Send guards + limits lock karo:** attachment size, empty-subject
   confirm (refuse nahi), attachment-mention warning, invalid address
   error.
8. **Trash/Spam retention + confirm:** kitne din, permanent delete
   confirm, restore kahan jayega.
9. **Reader safety flow:** remote images block + Load images, phishing
   warning, view source/headers, print/.eml download.
10. **Guest password-link flow:** wrong-password attempts/lockout,
    expired/revoked message, guest reply/download ka rule.
11. **Quota-full flow:** inbound reject ya queue, send block error,
    80%/90% warning, quota khaali karne ka rasta.
12. **Disable/delete + data export flow:** admin disable par mail/
    alias/queue ka kya hoga, user export ka rasta, delete ke baad
    address dobara use ho sakta hai ya nahi.
13. **Secure compose UX:** compose shuru karne se pehle encryption
    status + kaun padh sakta hai, Send button par saaf label.
14. **Plus-addressing vs true alias decision:** plus ko alag identity
    mana jayega ya nahi, catch-all OFF ke saath kya hoga.
15. **App-password revoke rule final karo:** main password change par
    app passwords bachenge ya revoke honge.

## B. Security / bot / DDoS / abuse — Day 1 (source: doc 22)

16. **Turnstile (Managed) + mandatory Siteverify** login, password-
    reset, alias creation, password-link creation par.
17. **Concrete rate-limit tiers** login/TOTP/reset/API ke liye,
    per-IP *aur* per-account, progressive delay + temporary (kabhi
    permanent nahi) lockout.
18. **Stalwart inbound throttles review + lock karo** (5 conn/sec per
    IP, 25/hour senderDomain->rcpt defaults samet), plus alag outbound
    per-user/per-domain throttles.
19. **SMTP/IMAP/JMAP brute-force defence:** Stalwart auto-block +
    fail2ban, documented unblock path ke saath.
20. **Anti-enumeration:** uniform responses, VRFY/EXPN disable, RCPT
    throttling, greylisting unknown senders ke liye.
21. **Mail-VPS DDoS plan likha hua:** provider L3/L4 mitigation
    confirmed, firewall sirf mail ports tak, mail VPS web/API VPS se
    alag, "Cloudflare mail ko protect karta hai" ka dawa nahi.
22. **Outbound caps + warmup cap:** per-account aur per-domain
    send/recipient caps soft deferral ke saath, plus new-IP warmup
    cap (proposal: ~50 recipients/hour day 1 se, ~25%/day badhao).
23. **Compromised-account containment:** spike alert + auto-suspend
    sending only + forced password reset + session/app-password
    revoke, sending restore se pehle.
24. **Per-message authenticated-user logging/header (ya hash)** har
    outbound message ke liye.
25. **Weak/compromised-password rejection** signup aur password change
    par.
26. **Account-takeover detection:** new device/IP alert + one-click
    revoke-all-sessions + refresh-token reuse detection.
27. **Open-relay test (fail hona chahiye)** aur reject-unknown-
    recipients SMTP session me (accept-then-bounce/backscatter nahi).
28. **Admin-panel lockdown:** Stalwart webadmin aur admin UI public
    internet par nahi (IP allowlist / VPN) + Turnstile + strict rate
    limits; WAF + Bot Fight rules saare HTTP login/API paths par.
29. **Security alerting + abuse playbook:** failed-auth storm,
    outbound-spike, blacklist-listing, DMARC-failure alerts, aur
    compromised-account steps (suspend sending -> reset -> revoke ->
    preserve evidence -> delist).
30. **Inbound malware/phishing/attachment controls:** DNSBL,
    greylisting, phishing protection, spam scoring + false-positive
    path; executables/scripts block/quarantine; ClamAV jaisa scan
    delivery se pehle; attachment size SMTP time par enforce.

## C. Infra / deliverability / ops — Day 1 (source: doc 23)

31. **Port-25 test asli VPS par dobara karo** (orgo-desktop wala test
    VPS ka proof nahi hai), FCrDNS + HELO match ke saath record karo.
32. **DMARC `rua` + TLS-RPT mailbox** publish karo, Stalwart report
    retention/parsing enable karo.
33. **Google Postmaster Tools register karo,** spam-rate alert <0.3%
    par, hard-bounce suppression list ke saath.
34. **`postmaster@` aur `abuse@` banao aur monitor karo.**
35. **IPv6 decision explicit karo:** disable karo, ya AAAA + PTR +
    SPF `ip6:` kam se kam /64 ke saath publish karo.
36. **SPF/DKIM edge cases verify karo:** SPF ≤10 lookups, DKIM
    2048-bit split TXT ke saath, selector-rotation overlap, DMARC
    `sp=` value, forwarding/ARC ka matlab.
37. **MTA-STS/DANE/DNSSEC all-or-nothing decision:** poora implement
    karo, ya kuch bhi publish mat karo — partial kabhi nahi.
38. **Stalwart-on-Cockroach compatibility test** advisory locks aur
    `40001`/`40003` retries ke saath, Cockroach commit karne se
    pehle. Fail hua to ADR-004 dobara khulega.
39. **Backup order runbook me likho:** data store pehle, blob store
    baad me, beech me purge nahi, versioned R2 bucket, RPO/RTO targets.
40. **Resource guardrails lock karo:** message size, mailbox quota,
    queue-disk quota, R2/Cockroach cost guardrails, connection limits.
41. **Bounce/queue rules likho:** hard vs soft bounce, retry schedule,
    queue-expiry/DSN timing, queue pause/resume, backscatter prevention.
42. **Authenticated-submission rule likho:** port 25 sirf local
    delivery ke liye unauthenticated, submission (587/465) par auth
    mandatory, relay sirf authenticated users tak.

## D. E2EE / privacy / compliance — Day 1 (source: doc 24)

43. **Key lifecycle:** expiry (<2 saal), rotation, pre-generated
    revocation certificate, compromised-key procedure — retired keys
    purani mail decrypt karne ke liye rakhni hongi.
44. **Header-protection policy (RFC 9788):** kaun se headers protect/
    hide honge, legacy clients par kya dikhega.
45. **Reply/forward rule E2EE mail ke liye:** quote naye ciphertext
    ke andar fold hoga, ya refuse/warn hoga — silently plaintext
    quote kabhi nahi, mixed/attacker-wrapped content decrypt kabhi nahi.
46. **Attachment E2EE scope lock karo:** envelope ke andar ya alag,
    filename protection, preview/download bina plaintext caching ke,
    password-link attachments.
47. **Attachment/phishing policy plaintext inbound ke liye** (file-type
    blocklist, archives, macros, quarantine) + disclosure ki E2EE
    bodies ka body-scan nahi ho sakta.
48. **Account-deletion flow:** Cockroach, R2, backups, key directory,
    aliases, password-links — aur jo delete nahi ho sakta (recipients
    ki copies) wo user ko saaf batana hoga.
49. **Retention schedule har category ke liye** — inbox, sent, spam,
    quarantine, trash, logs, DMARC reports, deleted data — ek saal
    ke log-retention rule ke saath reconcile karke.
50. **Privacy-policy content:** purposes, data types, processors
    (Cockroach, R2, VPS provider) naam ke saath, regions/transfers,
    rights, grievance contact, breach notification — sirf "policy
    hogi" kehna kaafi nahi.
51. **Backup "beyond use" + versioned-delete rule,** taaki deletion
    backups aur R2 versioning ke bawajood honest ho.
52. **Multi-device / lost-device rule:** backup-fetch gating,
    rotation par purane backups invalidate, aur disclosure ki session
    revoke karne se lost device par maujood key nahi hat ti.
53. **Key-directory integrity:** signed entries ya audit log,
    fingerprint verification, key-change warnings bhejne se pehle.
54. **Deleted aliases kabhi recycle nahi honge,** aur alias-mapping
    retention delete ke baad define hogi.
55. **Password-link hardening:** guess rate-limiting, no enumeration,
    expiry/revocation par R2 object delete — metadata-only revocation
    nahi.
56. **Client plaintext leakage rokna:** cache, snippets, notifications,
    service-worker storage me E2EE plaintext nahi; draft autosave ka
    decision (encrypt karo ya warn/disable karo E2EE ke liye).
57. **Lawful-disclosure statement:** kya de sakte hain (metadata/logs/
    non-E2EE mail) vs kya technically nahi de sakte (E2EE body bina
    user key ke) — "no-logs" over-promise nahi hoga.

## P1 — Day 1 me design karo, second wave me ship kar sakte ho

- Tags/labels vs folders, batch actions + shortcuts, search operators,
  Sieve builder UX, per-identity signature/templates, scheduled/undo
  send architecture, contacts/autocomplete source, notification
  settings, MDN read-receipt privacy decision, accessibility checklist.
- Cost-abuse caps, automated reputation monitoring (daily, weekly
  manual nahi), session/token hardening (refresh rotation + reuse
  detection, CSRF rule), supply-chain defence (pinning, SBOM, signed
  images, least-privilege env), geo/ASN challenge (Block nahi, sirf
  Managed Challenge, allowlist ke saath).
- Queue-age/deferred/auth-failure/cert-expiry monitoring (alert
  channel mail service ke bahar), blacklist set naam ke saath
  (Spamhaus ZEN/DBL, Spamcop, Barracuda, SORBS) + delisting procedure,
  TLS policy explicit (MX opportunistic, submission required),
  VPS-cutover verification + abort checklist, staging kabhi prod
  reputation pollute nahi karegi, log retention/access/clock-sync rule,
  R2 lifecycle/orphan rule, BIMI/ARC deferred record.
- Subkey model, data export/portability (E2EE sahi handle ho), spam/
  quarantine retention, region/residency pinning naam ke saath,
  phishing display rules (display-name spoofing, homograph, link
  warnings), non-seed recovery ka permanent decision (hoga ya kabhi
  nahi).

## Jo is checklist me nahi hai, wo Day-1 blocker nahi hai

BIMI Day-1 nahi hai (Verified Mark Certificate chahiye, deliverability
requirement nahi hai). ARC signing tabhi useful hai jab forwarding
asli flow ho. Ye dono ADR me deferred record honge, aadhe-adhure
add nahi honge.
