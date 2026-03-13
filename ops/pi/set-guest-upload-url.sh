#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
ENV_FILE=${RAVEBERG_ENV_FILE:-"$ROOT_DIR/ops/pi/env.appliance"}
EXAMPLE_FILE="$ROOT_DIR/ops/pi/env.appliance.example"

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <https://public-upload-host/guest/upload>" >&2
  exit 1
fi

GUEST_UPLOAD_URL=$1

case "$GUEST_UPLOAD_URL" in
  http://*|https://*)
    ;;
  *)
    echo "GUEST_UPLOAD_URL must start with http:// or https://" >&2
    exit 1
    ;;
esac

if [ ! -f "$ENV_FILE" ]; then
  if [ -f "$EXAMPLE_FILE" ]; then
    cp "$EXAMPLE_FILE" "$ENV_FILE"
  else
    : > "$ENV_FILE"
  fi
fi

TMP_FILE=$(mktemp "${TMPDIR:-/tmp}/raveberg-env.XXXXXX")
trap 'rm -f "$TMP_FILE"' EXIT INT TERM

awk -v guest_url="$GUEST_UPLOAD_URL" '
  BEGIN { replaced = 0 }
  /^GUEST_UPLOAD_URL=/ {
    print "GUEST_UPLOAD_URL=" guest_url
    replaced = 1
    next
  }
  { print }
  END {
    if (!replaced) {
      print "GUEST_UPLOAD_URL=" guest_url
    }
  }
' "$ENV_FILE" > "$TMP_FILE"

mv "$TMP_FILE" "$ENV_FILE"
trap - EXIT INT TERM

printf 'Updated %s\n' "$ENV_FILE"
printf 'GUEST_UPLOAD_URL=%s\n' "$GUEST_UPLOAD_URL"
printf 'Restart the Pi stack so the new QR/upload URL is picked up.\n'
