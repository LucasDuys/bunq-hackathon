#!/usr/bin/env bash
# Spin up the Next dev server + a cloudflared quick tunnel so bunq sandbox
# can hit /api/webhook/bunq. Prints the public URL once cloudflared is ready.
set -euo pipefail

PORT="${PORT:-3000}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared not found. Install:" >&2
  echo "  curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /tmp/cloudflared && sudo install /tmp/cloudflared /usr/local/bin/" >&2
  exit 1
fi

cleanup() { jobs -p | xargs -r kill 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# Tunnel
TUNNEL_LOG="$(mktemp)"
echo "Starting cloudflared tunnel on port ${PORT}…"
cloudflared tunnel --url "http://localhost:${PORT}" --no-autoupdate >"${TUNNEL_LOG}" 2>&1 &

# Wait for the public URL to appear in the log (up to 30s)
URL=""
for _ in $(seq 1 60); do
  URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "${TUNNEL_LOG}" | head -n1 || true)"
  [ -n "${URL}" ] && break
  sleep 0.5
done

if [ -z "${URL}" ]; then
  echo "Tunnel failed to come up. Last log:" >&2
  tail -n 20 "${TUNNEL_LOG}" >&2
  exit 1
fi

echo
echo "  Public URL:   ${URL}"
echo "  Webhook URL:  ${URL}/api/webhook/bunq"
echo "  Set BUNQ_WEBHOOK_URL in .env.local then run \`npm run bunq:register\`."
echo

# Dev server (foreground so logs are visible and Ctrl-C kills both)
npm run dev
