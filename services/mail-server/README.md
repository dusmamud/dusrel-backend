# mail-server — Stalwart infra (scope doc only, no code/config yet)

Purpose: Asli mail server — SMTP bhejna/lena, IMAP/JMAP se mailbox
dikhana, DKIM/SPF/DMARC, spam filter.

Ye service koi Hono HTTP API nahi hai. Iska contract SMTP / IMAP /
JMAP protocol hai.

Choice: Stalwart (Rust, alag infra service, is repo ka app code nahi).

Deploy: VPS ONLY — Ubuntu VPS, Docker Compose.
Kabhi Workers, Pages ya Render ke mail kaam par nahi jayega.
Reason: Workers par general inbound TCP listener nahi hai, outbound
port 25 prohibited hai, dedicated IP / PTR nahi milta.

Is folder me aayega (jab user approve karega): Stalwart deployment
doc, DNS checklist (`docs/08-mail-deliverability.md` se link),
aur config ka plan — bina secret ke. DKIM private key kabhi Git
me nahi aayegi.
