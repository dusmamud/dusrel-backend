#!/usr/bin/env bash
# Dusrel Mail — VPS backup script (v1 slice)
#
# Order (Stalwart backup docs + docs/23 P0-9 + docs/29):
#   1. DATA STORE pehle (Stalwart internal DataStore / RocksDB)
#   2. BLOB STORE baad me (Cloudflare R2 -> backup bucket)
#   Beech me koi purge nahi. Chal rahe data store ki files copy
#   karna backup NAHI hai — isliye script pehle Stalwart ko
#   stop karta hai (downtime window), tab volume ka tar banata
#   hai, phir Stalwart ko wapas start karta hai.
#
# Schedule: roz 02:00 par (cron, VPS host se) — 04:00 wale daily
# blob purge se overlap nahi hona chahiye. Agar backup 04:00 tak
# khatam na ho, to script ko rokna mat — agle din ka schedule
# check karo, kyunki purge ke beech me backup inconsistent ho
# sakta hai. Ye numbers starting values hain, locks nahi.
#
# Run (VPS host se, is repo ke services/mail-server folder se):
#   BACKUP_DIR=/var/backups/dusrel-mail \
#   R2_BACKUP_BUCKET=dusrel-mail-blobs-backup \
#   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
#   ./scripts/backup.sh
# Secrets kabhi is script me hardcode mat karo, env se do.
# R2 endpoint: https://<account>.r2.cloudflarestorage.com
# (R2_ACCOUNT_ID env se aata hai).
#
# Kya backup NAHI hota hai is script se (jaan-boojh kar):
# - .env (secrets) — wo Secure Vault me alag se rakho, backup
#   tar me kabhi mat dalo.
# - Search index, in-memory store, cache — Stalwart inhe dobara
#   bana leta hai (Stalwart docs).
# - Cockroach managed backup — wo alag hai, Cloudflare/Cockroach
#   console se weekly verify karo (docs/14).

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/dusrel-mail}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
R2_BACKUP_BUCKET="${R2_BACKUP_BUCKET:-}"
R2_ACCOUNT_ID="${R2_ACCOUNT_ID:-}"
COMPOSE_FILE="$(dirname "$0")/../docker-compose.yml"
STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
OUT_DIR="$BACKUP_DIR/$STAMP"

command -v docker >/dev/null || { echo "FAIL: docker nahi mila (VPS host par chalao)"; exit 1; }
command -v aws >/dev/null || { echo "FAIL: aws CLI nahi mila (R2 sync ke liye chahiye)"; exit 1; }
[ -n "$R2_BACKUP_BUCKET" ] || { echo "FAIL: R2_BACKUP_BUCKET env set karo"; exit 1; }
[ -n "$R2_ACCOUNT_ID" ] || { echo "FAIL: R2_ACCOUNT_ID env set karo"; exit 1; }

mkdir -p "$OUT_DIR"
echo "Backup shuru: $STAMP -> $OUT_DIR"

# Step 1: DATA STORE — Stalwart stop, volume tar, Stalwart start.
# `trap` isliye hai taaki script beech me fail ho tab bhi
# Stalwart wapas start ho jaye (mail down chhodna sabse bura hai).
echo "[1/4] Stalwart stop kar raha hoon (downtime window)..."
docker compose -f "$COMPOSE_FILE" stop stalwart
trap 'docker compose -f "$COMPOSE_FILE" start stalwart' EXIT
echo "[2/4] Data volume ka tar bana raha hoon..."
docker run --rm -v dusrel-mail_stalwart-data:/data:ro -v "$OUT_DIR:/backup" alpine tar czf "/backup/stalwart-data.tar.gz" -C /data .
echo "[3/4] Stalwart wapas start kar raha hoon..."
docker compose -f "$COMPOSE_FILE" start stalwart
trap - EXIT

# Step 1 ka proof: tar list ho raha hai ya nahi.
tar tzf "$OUT_DIR/stalwart-data.tar.gz" >/dev/null
echo "Data backup OK: $OUT_DIR/stalwart-data.tar.gz"

# Step 2: BLOB STORE — R2 source bucket -> backup bucket sync.
# Source bucket ka naam .env / VPS config se aana chahiye; yahan
# placeholder nahi diya gaya hai taaki galat bucket sync na ho.
# R2_SOURCE_BUCKET env set karna zaroori hai.
R2_SOURCE_BUCKET="${R2_SOURCE_BUCKET:-}"
[ -n "$R2_SOURCE_BUCKET" ] || { echo "FAIL: R2_SOURCE_BUCKET env set karo (source bucket ka naam andaze se nahi likha gaya)"; exit 1; }
echo "[4/4] R2 sync kar raha hoon: $R2_SOURCE_BUCKET -> $R2_BACKUP_BUCKET..."
aws s3 sync "s3://$R2_SOURCE_BUCKET" "s3://$R2_BACKUP_BUCKET" \
  --endpoint-url "https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com" \
  > "$OUT_DIR/r2-sync.log" 2>&1
echo "Blob backup OK (log: $OUT_DIR/r2-sync.log)"

# Compose + Caddyfile (bina secret ke) bhi backup me rakho,
# taaki restore par wahi stack dobara ban sake.
cp "$COMPOSE_FILE" "$OUT_DIR/docker-compose.yml"
cp "$(dirname "$0")/../Caddyfile" "$OUT_DIR/Caddyfile"

# Retention: purane backup folders delete karo.
find "$BACKUP_DIR" -maxdepth 1 -mindepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf {} + || true
echo "Backup poora: $OUT_DIR (retention: $RETENTION_DAYS din)"
