#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
ENV_FILE=${RAVEBERG_ENV_FILE:-"$ROOT_DIR/ops/pi/env.appliance"}

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

PUBLIC_BASE_URL=${PUBLIC_BASE_URL:-http://127.0.0.1:8085}
DISPLAY_PATH=${DISPLAY_PATH:-/display}
KIOSK_START_URL=${KIOSK_START_URL:-${PUBLIC_BASE_URL%/}${DISPLAY_PATH}}
WAIT_ATTEMPTS=${KIOSK_WAIT_ATTEMPTS:-180}
WAIT_INTERVAL=${KIOSK_WAIT_INTERVAL_SECONDS:-2}

"$ROOT_DIR/ops/pi/wait-for-url.sh" "$KIOSK_START_URL" "$WAIT_ATTEMPTS" "$WAIT_INTERVAL"

if command -v xset >/dev/null 2>&1; then
  xset s off || true
  xset -dpms || true
  xset s noblank || true
fi

if command -v unclutter >/dev/null 2>&1; then
  unclutter -idle 0.1 -root >/tmp/raveberg-unclutter.log 2>&1 &
fi

BROWSER=""
for candidate in chromium-browser chromium google-chrome-stable google-chrome; do
  if command -v "$candidate" >/dev/null 2>&1; then
    BROWSER=$candidate
    break
  fi
done

if [ -z "$BROWSER" ]; then
  echo "No Chromium-compatible browser found." >&2
  exit 1
fi

exec "$BROWSER" \
  --kiosk \
  --start-fullscreen \
  --no-first-run \
  --no-default-browser-check \
  --disable-session-crashed-bubble \
  --disable-infobars \
  --disable-translate \
  --autoplay-policy=no-user-gesture-required \
  --overscroll-history-navigation=0 \
  --check-for-update-interval=31536000 \
  --disk-cache-dir=/tmp/raveberg-chromium-cache \
  --simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT' \
  "$KIOSK_START_URL"
