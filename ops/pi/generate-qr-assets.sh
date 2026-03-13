#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
ENV_FILE=${RAVEBERG_ENV_FILE:-"$ROOT_DIR/ops/pi/env.appliance"}
OUTPUT_DIR=${RAVEBERG_QR_OUTPUT_DIR:-"$ROOT_DIR/ops/pi/generated"}

if ! command -v qrencode >/dev/null 2>&1; then
  echo "qrencode is required to generate QR assets." >&2
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

PUBLIC_BASE_URL=${PUBLIC_BASE_URL:-http://127.0.0.1:8085}
GUEST_UPLOAD_URL=${GUEST_UPLOAD_URL:-}
GUEST_UPLOAD_PATH=${GUEST_UPLOAD_PATH:-/guest/upload}
ADMIN_PATH=${ADMIN_PATH:-/admin/login}

mkdir -p "$OUTPUT_DIR"

if [ -n "$GUEST_UPLOAD_URL" ]; then
  GUEST_UPLOAD_TARGET=$GUEST_UPLOAD_URL
else
  GUEST_UPLOAD_TARGET="${PUBLIC_BASE_URL%/}${GUEST_UPLOAD_PATH}"
fi

qrencode -o "$OUTPUT_DIR/guest-upload.png" "$GUEST_UPLOAD_TARGET"
qrencode -o "$OUTPUT_DIR/admin-login.png" "${PUBLIC_BASE_URL%/}${ADMIN_PATH}"

printf '%s\n' "Generated:"
printf '  %s\n' "$OUTPUT_DIR/guest-upload.png"
printf '  %s\n' "$OUTPUT_DIR/admin-login.png"
