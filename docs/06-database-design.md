# Database Design — Cockroach + R2

Status: DRAFT — 2026-10-31

## Principle — ek cluster, alag schema per service

- Ek CockroachDB Cloud cluster, single region Phase 1 me.
- Har service ka apna schema: `auth`, `mail`, `drive`, `chat`, `meet`.
- Koi service dusri service ke schema ki table seedha UPDATE/DELETE
  nahi karegi. Cross-service zaroorat ho to API ke through hogi.
- Migration: Drizzle migrations, ek service ki migration dusri
  service ko tode nahi — ye rule code aane par test se prove hoga.

## Cockroach — kya store hoga (table-level idea, final schema code me)

### auth schema

- users: id, email (unique), password_hash (Argon2id), totp_enabled,
  created_at, status
- sessions / refresh tokens: hash only, expiry, device info (bina
  sensitive data ke)
- app_passwords: hash only, label, last_used, revoked

Kabhi store nahi hoga: plaintext password, seed phrase, private key.

### mail schema

- aliases: id, user_id, alias_address (unique), is_active, created_at
- message_metadata: id, user_id, r2_object_key, subject_hash ya
  subject (E2EE mail par subject ka rule security doc me hai),
  from/to metadata, received_at, folder, flags
- public_keys: user_id, public_key_armored, fingerprint, created_at,
  revoked_at
- encrypted_private_key_backups: user_id, ciphertext, salt/nonce
  parameters, version — server isko decrypt nahi kar sakta
- password_links: id, r2_object_key, expiry_at, revoked, max_views
  (design lock baad me)

### drive / chat / meet schema — future, sirf naam

- drive: files (metadata + r2_key), folders, shares
- chat: rooms, members, messages (metadata; E2EE baad me alag design)
- meet: rooms, participants, recordings metadata (baad me)

## R2 — object layout (naming rule, final code me lock hoga)

- Bucket alag per concern: mail blobs ke liye alag, Drive files ke
  liye alag — ek bucket me sab mix nahi hoga.
- Key pattern me hamesha: `<service>/<user_id>/<object_id>` jaisa
  prefix hoga, taaki ek user ka data dusre se list na ho.
- R2 keys kabhi frontend ko seedha nahi di jayengi — presigned URL
  backend se, expiry kam, aur sirf us user ke liye.
- Versioning: mail blobs aur Drive files ke bucket par versioning
  on rakhne ka decision operations doc me hai — accidental delete
  se bachne ke liye.
- Lifecycle: trash / expired password-links ke objects ko delete
  karne ka rule baad me lock hoga, bina rule ke auto-delete nahi.

## Kya kahan nahi store hoga — checklist

- [ ] Mail body Cockroach me nahi
- [ ] Private key plaintext me kahin nahi
- [ ] Seed phrase server par kahin nahi
- [ ] Password hash ke alawa password kahin nahi
- [ ] R2 object key se user ka email ya naam guess na ho (opaque id
  use hoga)
- [ ] Logs me mail body, key, password, token nahi

## Backup design

- Cockroach: managed backup on, plus periodic export ka test.
- R2: versioning + alag bucket me copy (baad me, cost dekh kar).
- Backup restore ka test launch se pehle ek baar zaroor hoga —
  bina restore test ke backup ka dawa nahi karna.
