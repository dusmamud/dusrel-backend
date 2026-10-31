#!/usr/bin/env bash
# Dusrel Mail — VPS disk alert script (v1 slice)
#
# Kya karta hai: root disk usage check karta hai. Threshold
# (default 80%, docs/14 ka rule) paar ho to ek external webhook
# par alert bhejta hai. Webhook KABHI Dusrel mail service nahi
# hona chahiye (docs/29 ka rule: alert channel mail service ke
# bahar hona chahiye, warna mail down hote hi alert bhi band).
# Example channels: ntfy topic, Telegram bot, ya koi aur webhook
# jo mail par depend na kare. Kaunsa channel final hai, ye VPS
# par lock karna hai — yahan sirf placeholder hai.
#
# Run (VPS host crontab se, har 15 minute — starting value):
#   */15 * * * * ALERT_WEBHOOK_URL=https://ntfy.sh/dusrel-alerts-example /path/to/scripts/disk-alert.sh
# (ntfy.sh wali URL sirf example hai — apna topic set karo.)

set -euo pipefail

THRESHOLD="${DISK_THRESHOLD:-80}"
MOUNT="${DISK_MOUNT:-/}"
WEBHOOK="${ALERT_WEBHOOK_URL:-}"

USAGE="$(df --output=pcent "$MOUNT" | tail -1 | tr -dc '0-9')"

if [ "$USAGE" -lt "$THRESHOLD" ]; then
  echo "OK: disk $MOUNT par $USAGE% hai (threshold $THRESHOLD%)"
  exit 0
fi

MSG="ALERT: Dusrel VPS disk $MOUNT par $USAGE% hai (threshold $THRESHOLD%) — jaldi action lo, warna mail queue/disk-full risk hai."
echo "$MSG" >&2

if [ -z "$WEBHOOK" ]; then
  echo "FAIL: ALERT_WEBHOOK_URL set nahi hai — alert channel (mail service ke bahar) VPS par set karo, warna ye alert kahin nahi pahunchega." >&2
  exit 1
fi

# Body plain text hai (ntfy jaise webhooks ke liye sahi format).
# Discord/Slack jaise webhooks ko alag JSON format chahiye hota
# hai — agar wahi channel final ho to ye curl line VPS par us
# format me badlo, yahan andaze se koi format mat likho.
curl -fsS -X POST -H "Content-Type: text/plain" \
  -d "$MSG" "$WEBHOOK" >/dev/null
echo "Alert bheja gaya: $WEBHOOK"
