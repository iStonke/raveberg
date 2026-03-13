#!/bin/sh
set -eu

DISPLAY_URL=${1:-${RAVEBERG_DISPLAY_URL:-}}

if [ -z "$DISPLAY_URL" ]; then
  echo "[raveberg-mac-display] Usage: $0 <http://<PI-IP>:8085/display>" >&2
  echo "[raveberg-mac-display] Example: $0 http://192.168.178.92:8085/display" >&2
  exit 1
fi

CHROME_APP=""
for candidate in "Google Chrome" "Chromium" "Google Chrome Canary"; do
  if [ -d "/Applications/$candidate.app" ]; then
    CHROME_APP=$candidate
    break
  fi
done

if [ -z "$CHROME_APP" ]; then
  echo "[raveberg-mac-display] No Chrome-compatible browser found in /Applications." >&2
  echo "[raveberg-mac-display] Install Google Chrome or Chromium and try again." >&2
  exit 1
fi

echo "[raveberg-mac-display] opening $DISPLAY_URL with $CHROME_APP"

exec open -na "$CHROME_APP" --args \
  --kiosk \
  --start-fullscreen \
  --autoplay-policy=no-user-gesture-required \
  --disable-session-crashed-bubble \
  --disable-infobars \
  --no-default-browser-check \
  --overscroll-history-navigation=0 \
  "$DISPLAY_URL"
