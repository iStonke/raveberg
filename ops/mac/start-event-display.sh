#!/usr/bin/env bash

PI_IP="$1"

if [ -z "$PI_IP" ]; then
  echo "Usage: $0 <PI-IP>"
  exit 1
fi

URL="http://$PI_IP:8085/display"

echo "Starting RAVEBERG display client..."
echo "URL: $URL"

# Versuche Chrome oder Chromium zu finden
if [ -d "/Applications/Google Chrome.app" ]; then
  BROWSER="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
elif [ -d "/Applications/Chromium.app" ]; then
  BROWSER="/Applications/Chromium.app/Contents/MacOS/Chromium"
else
  echo "No Chrome/Chromium found in /Applications"
  exit 1
fi

# Browser im Kiosk starten
"$BROWSER" \
  --kiosk \
  --incognito \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --no-first-run \
  --no-default-browser-check \
  "$URL"