#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
RUNTIME_DIR=${RAVEBERG_RUNTIME_DIR:-"$ROOT_DIR/ops/pi/runtime"}
LOG_FILE=${RAVEBERG_CLOUDFLARED_LOG:-"$RUNTIME_DIR/cloudflared.log"}
PID_FILE=${RAVEBERG_CLOUDFLARED_PID_FILE:-"$RUNTIME_DIR/cloudflared.pid"}

log() {
  printf '[stop-event] %s\n' "$*"
}

if [ ! -f "$PID_FILE" ]; then
  log "No cloudflared pid file found at $PID_FILE"
  exit 0
fi

PID=$(cat "$PID_FILE" 2>/dev/null || true)
if [ -n "${PID:-}" ] && kill -0 "$PID" 2>/dev/null; then
  log "Stopping cloudflared process $PID"
  kill "$PID" 2>/dev/null || true
else
  log "cloudflared process already stopped"
fi

rm -f "$PID_FILE"

log "Tunnel stopped. Log file remains at $LOG_FILE"
