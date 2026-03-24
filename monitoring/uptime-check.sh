#!/bin/bash
# ToolRelay API — Uptime Monitor
# Cron example: */5 * * * * bash /path/to/uptime-check.sh >> /var/log/toolrelay-uptime.log 2>&1

URL=${TOOLRELAY_URL:-https://toolrelay-api.onrender.com}
SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL:-}

RESPONSE=$(curl -s -o /tmp/toolrelay_health.json -w "%{http_code}" --max-time 10 "$URL/health" 2>/dev/null)
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

if [ "$RESPONSE" != "200" ]; then
  echo "$TIMESTAMP ALERT: ToolRelay health check FAILED (HTTP $RESPONSE) — $URL"
  if [ -n "$SLACK_WEBHOOK_URL" ]; then
    curl -s -X POST "$SLACK_WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"🚨 *ToolRelay API DOWN* — HTTP $RESPONSE at $URL ($TIMESTAMP)\"}" \
      > /dev/null
  fi
  exit 1
else
  BODY=$(cat /tmp/toolrelay_health.json 2>/dev/null || echo "{}")
  echo "$TIMESTAMP OK: ToolRelay healthy (HTTP $RESPONSE) — $BODY"
  exit 0
fi
