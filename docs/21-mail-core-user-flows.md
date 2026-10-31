# Mail Core — User Flows (Detailed)

Status: DRAFT — 2026-10-31
Source: 4 parallel subagents, Exa-verified (REST connector, not MCP).
Ye doc `02-prd.md`, `05-api-contracts.md`, `13-testing-qa.md` aur
`20-web-app.md` ko replace nahi karta — wo docs jo pehle se kehte
hain, yahan dobara nahi likha gaya hai, sirf unke gaps bhare gaye
hain. Jo flow yahan nahi hai, wo abhi bhi missing mana jayega.

## F1. Admin user banata hai — Phase 1, public signup nahi hai

Phase 1 me user khud signup nahi karega, admin banayega:

1. Admin (Owner role) naya user banata hai, mailbox + quota set karta hai.
2. User ko first-login invite milta hai.
3. User pehli baar login karke apna password set karta hai.
4. User apni primary identity (naam + primary address) confirm karta hai.

**Day-1 gap (P0):** Invite ki expiry, beech me chhodne par kya hoga,
invite dobara bhejne ka rule — ye pehle se lock nahi tha. Rule:
invite single-use, expiry kam (code phase me number lock hoga),
expiry ke baad admin ko naya invite bhejna padega, purana invite
kaam nahi karega.

## F2. First-run onboarding

1. Login ke baad default folders: Inbox, Sent, Drafts, Archive, Spam, Trash.
2. Guided tour / first-time hints.
3. User pehli identity, signature aur theme/display setting check karta hai.
4. Empty inbox state: "koi mail nahi" + Compose ka rasta — blank page nahi.

## F3. Login + session

1. Email + password.
2. TOTP on ho to TOTP code.
3. Success par inbox, session banta hai.
4. Session expire ho to recoverable state: "session expired, dobara
   login karo" — silently stale credential se kaam nahi chalega.
5. Logout par in-memory state clear, sync ruk jaye.
6. User apne saare sessions dekh sake, ek ya sab ko revoke kar sake.

**Day-1 gap (P0):** Idle timeout, refresh-token rotation, "sign out
all devices" ka button, device/IP/last-active ka display — ye pehle
sirf "session list/revoke" naam se tha, UX nahi tha. Ab ye flow ka
hissa hai, number code phase me lock honge.

## F4. Password change + forgot password — NORMAL account ke liye

Logged-in:
1. Purana password + naya password (2 baar) -> change.
2. Saare sessions invalidate karne ka option + confirmation (password
   mail me kabhi nahi aayega).

Logged-out (forgot):
1. "Forgot password" -> email dalo -> hamesha ek jaisa message:
   "agar account hai to link bheja gaya hai" — chahe account ho ya
   na ho, enumeration nahi hona chahiye.
2. Single-use, expiry wala reset token email se jata hai.
3. Token se naya password set hota hai, phir normal login — auto-login nahi.
4. Reset ke baad saare sessions aur purane reset links invalidate,
   user ko notification milegi.

**E2EE boundary — saaf rakhna hai:** Ye flow sirf normal login
password ke liye hai. Ye E2EE mail ko unlock nahi karta. Seed kho
gaya to E2EE mail nahi khulega — ye baat isi flow me user ko saaf
dikhani hai.
Source: OWASP Forgot Password Cheat Sheet.

## F5. 2FA setup, use aur recovery

1. Settings me 2FA on -> QR + manual key -> authenticator me add ->
   ek code se verify -> tabhi 2FA on hota hai.
2. Setup ke waqt hi single-use backup/recovery codes milte hain,
   user unko safe jagah save karta hai.
3. Login par password ke baad TOTP ya backup code chalta hai.
4. Phone kho gaya to: backup code se login -> naya authenticator
   enroll -> purana factor revoke + notification.
5. MFA factor change ke liye sirf active session kaafi nahi — dobara
   existing factor se re-authenticate karna padega, aur change par
   out-of-band notification jayegi.

**Day-1 gap (P0):** Pehle sirf "TOTP on/off" likha tha, recovery
flow nahi tha. Bina iske ek phone kho jaane par user hamesha ke
liye lockout ho jayega.
Source: OWASP Multifactor Authentication Cheat Sheet.

## F6. App passwords (IMAP clients ke liye)

1. Settings me app ka naam dekar app password banao.
2. Wo password sirf ek baar dikhega, dobara nahi.
3. Thunderbird / Apple Mail / FairEmail me dalo.
4. Ek app password ko alag se revoke kar sakte ho, bina main
   password badle.

**Day-1 gap (P0, final rule lock karna hai):** Main password
change/revoke hone par app passwords bachenge ya revoke honge?
Pehle docs me ye sirf "design lock ke hisaab se" par atka tha.
Ab ye checklist me hai — code se pehle iska final rule likhna hi
hoga, warna tester verify nahi kar payega.

## F7. Inbox padhna

1. List: unread count, sender, subject, date, attachment icon, star.
2. Message kholo: body, attachments, sender details.
3. Mark read/unread, star/unstar, archive, move, delete, spam/not-spam.
4. Threading on ho to ek conversation ek jagah, oldest-first.
5. Naya mail bina refresh ke aaye (live update), bada mailbox
   pagination / virtual scroll se slow na ho.

## F8. Compose + send

1. Compose -> To / Cc / Bcc, From identity picker, Subject, body editor.
2. To me autocomplete, galat address par saaf error.
3. Attachment add karo, size limit se pehle hi saaf error mile.
4. Draft auto-save, identity + quoted headers ke saath.
5. Send guards (Day-1 lock, pehle ye numbers/rules nahi the):
   - Empty subject ho to confirm puche, refuse na kare.
   - Attachment ka zikr ho aur file na lagi ho to warning de.
   - Galat address par error mile, send silently fail na ho.
6. Send success par Sent me dikhe; send fail ho to draft wahi rahe
   aur retry ka rasta mile — draft gayab nahi hona chahiye.
7. Secure compose: encryption compose shuru karne se pehle on
   hona chahiye, top par saaf likha ho ki message encrypted hai ya
   nahi, aur kaun padh sakta hai. Study me ~10% log galti se
   sensitive mail plaintext bhej dete hain jab status saaf nahi hota.

## F9. Reply / Reply-all / Forward

1. Reply, Reply-all ya Forward chuno.
2. Quoted text editable island me aaye, original layout na toote.
3. Reply-all me saare original recipients aayein, user kisi ko hata sake.
4. Forward me original attachments select karke rakhne/hatane ka option.
5. Alias par aaye mail ka reply usi alias se auto-fill ho — haath
   se From badalna na pade.
6. Signature identity ke hisaab se, quoted text ke upar ya neeche,
   user ki setting se lage.

**E2EE warning (detail `24-...` me hai):** E2EE mail ka reply/
forward quoted decrypted history ko naye ciphertext ke andar fold
karega, warna refuse/warn karega — silently plaintext quote nahi
hoga.

## F10. Mail receive + spam handle

1. Bahar se mail MX se aata hai -> spam/sender check -> Inbox ya Spam.
2. Spam me galat mail ko "Not Spam" karke Inbox me lao; Inbox ke
   spam ko "Report Spam / Block Sender" karo.
3. Block ke baad us sender ka mail dobara Inbox me na aaye, unblock
   ka rasta bhi ho.
4. Reader me remote images / trackers by default load na hon,
   "Load images" dabane par hi load hon, phishing warning dikhe.

## F11. Folders, archive, trash

1. Folder banao / rename / delete, nested folders ho sakein to behtar.
2. Move, Archive, Trash.
3. Trash se restore ho sake, permanent delete par confirm puche.
4. Trash/Spam khaali karne ka alag confirm ho.

**Day-1 gap (P0):** Trash/Spam retention period pehle nahi tha.
Ab rule hai: retention period code se pehle lock hoga, restore
original folder me jayega (ya Inbox, rule lock hoga), bina retention
ke mailbox bhar jayega ya mail galti se hamesha ke liye delete ho
jayega.

## F12. Alias manage karna

1. Naya alias banao (label + address), on/off kar sakte ho.
2. Alias se bhejo aur alias par lo, asli address chhupa rahe.
3. Alias delete/disable par us alias par aata mail kya hoga, rule saaf ho.
4. **Plus-addressing vs true alias:** `name+shop@domain` ko
   advertiser aasani se strip karke track kar sakta hai, isliye asli
   privacy ke liye true alias chahiye. Plus ko alag identity mana
   jayega ya nahi, ye decision flow me lock hoga. Catch-all by
   default OFF rahega.
Source: Privacy Guides email aliasing.

## F13. Search + filters

1. Search scope saaf ho: current folder ya all folders.
2. Filter: From / To / Subject / Body / Attachment / date.
3. E2EE mail par search ki limit UI me saaf ho — server full-text
   search E2EE body par nahi chalega, sirf metadata / client-side.
4. Sieve filter visual builder: condition -> action (move / star /
   forward / discard), vacation responder date range ke saath.

**P1 (design Day 1, ship baad me):** Tags/labels vs folders ka
decision, batch actions + keyboard shortcuts, search operators /
saved searches, per-identity signature/templates, scheduled send /
undo send ka architecture, contacts/autocomplete source, notification
settings, read receipts (MDN) ka privacy decision, accessibility
checklist (keyboard se inbox->compose->send ka poora rasta).

## F14. Settings

1. Profile: naam, primary identity, signature per identity.
2. Display: theme, layout (3-pane / list / bottom pane), density, order.
3. Security: password change, 2FA, backup codes, app passwords, sessions.
4. Quota: kitni use hui, kitni baki hai.

**Day-1 gap (P0):** Quota-full flow pehle nahi tha. Ab: inbound
reject ya queue, send block error, 80%/90% warning, quota khaali
karne ka rasta (bade attachments dhoondhna) — ye sab code se pehle
lock hoga.

## F15. Password-protected mail — Guest ka flow

1. Guest link kholta hai -> password dalta hai -> browser me mail
   decrypt hoke dikhta hai.
2. Galat password par saaf error, koshishon ki limit / lockout rule ho.
3. Expired/revoked link par saaf message — kaaran chhupa na ho,
   lekin sensitive detail leak na ho.
4. Guest sirf us mail ko padh sake, poora mailbox nahi — aur ye
   saaf ho ki guest reply kar sakta hai ya nahi, attachment download
   kar sakta hai ya nahi, aur link forward hone ka risk warning kya hogi.

## F16. Admin flows (Owner)

1. Admin user banata / disable / delete karta hai, quota set karta hai.
2. Disable/delete par us user ke aliases, queued mail aur stored
   mail ka kya hoga, rule pehle se lock ho.
3. Admin abuse par user ko block kar sake, unblock ka rasta ho.
4. Admin ko user ka mail body ya private key kabhi nahi dikhni
   chahiye — admin action bhi audit log me aaye, bina body ke.

**Day-1 gap (P0):** Disable/delete + data export flow pehle nahi
tha. User apna data export kaise karega, delete ke baad address
dobara use ho sakta hai ya nahi — ye trust ka sawaal hai, Phase 4
tak mat chhodo.
