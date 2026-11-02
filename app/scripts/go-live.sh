#!/usr/bin/env bash
# Opens the live payment button: keeps this Mac awake, runs the relay, opens a public tunnel to it,
# gives the site its address and redeploys. Leave this window open. Ctrl+C closes the button.
set -euo pipefail
cd "$(dirname "$0")/.."
log=$(mktemp)
key=$(grep '^RELAY_KEY=' .env | cut -d= -f2)

caffeinate -dis ./node_modules/.bin/tsx --env-file=.env scripts/relay.ts &
relay=$!
cloudflared tunnel --no-autoupdate --url http://127.0.0.1:8787 > "$log" 2>&1 &
tunnel=$!
trap 'kill $relay $tunnel 2>/dev/null' EXIT

url=""
for _ in $(seq 1 30); do
  url=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$log" | head -1 || true)
  [ -n "$url" ] && break
  sleep 1
done
[ -n "$url" ] || { echo "The tunnel didn't start:"; cat "$log"; exit 1; }

for name in RELAY_URL RELAY_KEY; do vercel env rm "$name" production --yes >/dev/null 2>&1 || true; done
printf '%s' "$url" | vercel env add RELAY_URL production >/dev/null
printf '%s' "$key" | vercel env add RELAY_KEY production >/dev/null
vercel deploy --prod --yes 2>&1 | grep -E 'Aliased|Error:' || true

echo "Live. Leave this window open."
wait
