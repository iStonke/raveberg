#!/bin/sh

set -eu

APP_DIR=/app
LOCKFILE="$APP_DIR/package-lock.json"
NODE_MODULES_DIR="$APP_DIR/node_modules"
STAMP_FILE="$NODE_MODULES_DIR/.package-lock.sha256"

compute_hash() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
    return
  fi

  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
    return
  fi

  echo ""
}

needs_install=false

if [ ! -d "$NODE_MODULES_DIR" ]; then
  needs_install=true
elif [ ! -f "$NODE_MODULES_DIR/qrcode/package.json" ]; then
  needs_install=true
elif [ ! -f "$STAMP_FILE" ]; then
  needs_install=true
fi

CURRENT_HASH="$(compute_hash "$LOCKFILE")"

if [ "$needs_install" = false ] && [ -n "$CURRENT_HASH" ]; then
  SAVED_HASH="$(cat "$STAMP_FILE" 2>/dev/null || true)"
  if [ "$CURRENT_HASH" != "$SAVED_HASH" ]; then
    needs_install=true
  fi
fi

if [ "$needs_install" = true ]; then
  echo "[frontend] Installing npm dependencies..."
  npm install
  mkdir -p "$NODE_MODULES_DIR"
  if [ -n "$CURRENT_HASH" ]; then
    printf '%s\n' "$CURRENT_HASH" > "$STAMP_FILE"
  fi
else
  echo "[frontend] npm dependencies already up to date."
fi

exec npm run dev -- --host 0.0.0.0 --port 5173
