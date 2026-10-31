# Docs Index — kaun sa doc kis sawaal ka jawab deta hai

| Doc | Sawaal | Kaun padhe |
|---|---|---|
| `01-product-overview.md` | Dusrel Backend kya hai, kiske liye, kyu alag hai? | Sab — pehle ye |
| `02-prd.md` | Kya banega, kya nahi, kaun se user, kaun se feature Phase 1 me? | Product + dev |
| `03-trd.md` | Stack kya hai, constraints kya hain, kya nahi karna? | Dev + infra |
| `04-architecture.md` | System kaise judta hai, data kahan se kahan jata hai? | Dev + reviewer |
| `05-api-contracts.md` | Har service ka API shape kya hoga, auth kaise hoga? | Frontend + backend dev |
| `06-database-design.md` | Cockroach me kaun si table/schema, R2 me kaun sa object? | Backend dev |
| `07-security-e2ee.md` | Seed, keys, encryption, threats, aur honest limits kya hain? | Sab — security ke liye zaroori |
| `08-mail-deliverability.md` | Mail Gmail/Outlook inbox me kaise pahuchega, spam me kyu nahi? | Infra + mail dev |
| `09-deployment.md` | Kya kahan deploy hoga, VPS kaise badlega, Workers ka scope kya hai? | Infra |
| `10-project-structure.md` | Folder, naming, shared packages ke rules kya hain? | Har naya contributor |
| `11-roadmap.md` | Phase 1, 2, 3, 4, 5 me kya, kis order me? | Product + dev |
| `12-decisions-adr.md` | Har bada decision kyu liya, rejected option kya tha? | Reviewer, future dev |
| `13-testing-qa.md` | Launch se pehle kaun se test pass hone hi chahiye? | QA + dev |
| `14-operations-runbook.md` | Backup, monitoring, outage me kya karna hai? | Ops |
| `15-client-overview.md` | Web ke baad Android, iOS, Desktop ka shared plan kya hai? | Sab — client plan ke liye |
| `16-android-native.md` | Android native app ka stack, offline-first, security kya hoga? | Android dev |
| `17-ios-swift.md` | iOS Swift app ka stack, SwiftData, Keychain kya hoga? | iOS dev |
| `18-desktop.md` | Desktop app Tauri se kyu, Electron kab, security kya hogi? | Desktop dev |
| `19-client-security-sync.md` | Native clients (Android, iOS, Desktop) par ek hi security + sync rulebook kya hai? Web ki security `docs/20` me hai. | Sab client dev |
| `20-web-app.md` | Web app ka poora spec kya hai — pehla client, Cloudflare Pages, PWA, E2EE? | Web dev — pehle ye, native se pehle |
| `21-mail-core-user-flows.md` | Mail ke step-by-step user flows kya hain, Day 1 ke flow gaps kaun se the? | Product + web dev |
| `22-mail-core-security-bot-ddos.md` | Bot, brute-force, DDoS, outbound spam, takeover se kaise bachenge? | Security + infra |
| `23-mail-core-infra-deliverability.md` | Deliverability, bounce/queue, backup order, Cockroach test ke gaps kaun se the? | Infra + mail dev |
| `24-mail-core-e2ee-privacy.md` | Key lifecycle, retention, deletion, privacy-policy content ke gaps kaun se the? | Security + product |
| `25-mail-core-day1-checklist.md` | Mail Phase 1 shuru karne se pehle lock hone wali master checklist kya hai? | Sab — build se pehle ye |
| `26-architecture-audit-findings.md` | A-Z docs ka technical cross-verification, real-world protocols, cloud limits aur fixes kya hain? | Sab — architecture review ke liye |
| `27-account-signup-recovery.md` | Signup, forgot password, secondary recovery email, admin reset, seed restore ka A-Z flow kya hai? | Sab — account + recovery ke liye |
| `28-admin-dashboard-moderation.md` | Admin/Superadmin roles, dashboard scope, account states, spam lifecycle, appeal kaise hoga? | Admin + reviewer — internal tool ke liye |

## Docs ke version rule

- Har doc ke top par status likha hai: `DRAFT` ya `LOCKED`.
- DRAFT ka matlab hai discussion ke liye taiyaar, implementation ka
  base nahi.
- LOCKED tabhi hoga jab user us doc ko alag se approve karega.
- Koi doc badle to `12-decisions-adr.md` me uska reason aur date add karo.
- Docs me koi secret, API key, password, connection string nahi hogi.
