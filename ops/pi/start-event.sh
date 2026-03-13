#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
ENV_FILE=${RAVEBERG_ENV_FILE:-"$ROOT_DIR/ops/pi/env.appliance"}
EXAMPLE_FILE="$ROOT_DIR/ops/pi/env.appliance.example"
RUNTIME_DIR=${RAVEBERG_RUNTIME_DIR:-"$ROOT_DIR/ops/pi/runtime"}
LOG_FILE=${RAVEBERG_CLOUDFLARED_LOG:-"$RUNTIME_DIR/cloudflared.log"}
PID_FILE=${RAVEBERG_CLOUDFLARED_PID_FILE:-"$RUNTIME_DIR/cloudflared.pid"}
LOCAL_PROXY_URL=${RAVEBERG_LOCAL_PROXY_URL:-http://localhost:8085}
GUEST_UPLOAD_PATH=${RAVEBERG_GUEST_UPLOAD_PATH:-/guest/upload}
WAIT_SECONDS=${RAVEBERG_QUICK_TUNNEL_WAIT_SECONDS:-30}
POLL_INTERVAL=${RAVEBERG_QUICK_TUNNEL_POLL_INTERVAL_SECONDS:-1}

log() {
  printf '[start-event] %s\n' "$*"
}

fail() {
  printf '[start-event] ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Required command not found: $1"
  fi
}

ensure_env_file() {
  if [ ! -f "$ENV_FILE" ]; then
    if [ -f "$EXAMPLE_FILE" ]; then
      cp "$EXAMPLE_FILE" "$ENV_FILE"
    else
      : > "$ENV_FILE"
    fi
  fi
}

compose_up() {
  docker compose --env-file "$ENV_FILE" up -d --build
}

stop_existing_tunnel() {
  if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "${OLD_PID:-}" ] && kill -0 "$OLD_PID" 2>/dev/null; then
      log "Stopping existing cloudflared process $OLD_PID"
      kill "$OLD_PID" 2>/dev/null || true
      sleep 1
    fi
    rm -f "$PID_FILE"
  fi
}

start_tunnel() {
  : > "$LOG_FILE"
  log "Starting cloudflared quick tunnel to $LOCAL_PROXY_URL"
  nohup cloudflared tunnel --no-autoupdate --url "$LOCAL_PROXY_URL" >>"$LOG_FILE" 2>&1 &
  TUNNEL_PID=$!
  printf '%s\n' "$TUNNEL_PID" > "$PID_FILE"
  log "cloudflared pid=$TUNNEL_PID log=$LOG_FILE"
}

extract_tunnel_url() {
  if [ ! -f "$LOG_FILE" ]; then
    return 1
  fi

  grep -Eo 'https://[-a-z0-9]+\.trycloudflare\.com' "$LOG_FILE" | tail -n 1
}

wait_for_tunnel_url() {
  ATTEMPTS=$((WAIT_SECONDS / POLL_INTERVAL))
  if [ "$ATTEMPTS" -lt 1 ]; then
    ATTEMPTS=1
  fi

  COUNT=0
  while [ "$COUNT" -lt "$ATTEMPTS" ]; do
    if ! kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
      fail "cloudflared exited before exposing a tunnel URL. See $LOG_FILE"
    fi

    FOUND_URL=$(extract_tunnel_url || true)
    if [ -n "${FOUND_URL:-}" ]; then
      printf '%s\n' "$FOUND_URL"
      return 0
    fi

    COUNT=$((COUNT + 1))
    sleep "$POLL_INTERVAL"
  done

  if [ -f "$PID_FILE" ]; then
    CURRENT_PID=$(cat "$PID_FILE" 2>/dev/null || true)
    if [ -n "${CURRENT_PID:-}" ] && kill -0 "$CURRENT_PID" 2>/dev/null; then
      kill "$CURRENT_PID" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi

  fail "No trycloudflare URL found within ${WAIT_SECONDS}s. See $LOG_FILE"
}

main() {
  require_command docker
  require_command cloudflared
  require_command grep
  require_command awk

  mkdir -p "$RUNTIME_DIR"
  ensure_env_file

  log "Starting appliance stack with $ENV_FILE"
  compose_up

  stop_existing_tunnel
  start_tunnel

  TUNNEL_URL=$(wait_for_tunnel_url)
  FINAL_UPLOAD_URL="${TUNNEL_URL%/}${GUEST_UPLOAD_PATH}"

  log "Setting guest upload URL to $FINAL_UPLOAD_URL"
  "$ROOT_DIR/ops/pi/set-guest-upload-url.sh" "$FINAL_UPLOAD_URL"

  log "Restarting appliance stack so frontend/backend pick up the new runtime URL"
  compose_up

  printf '\n'
  printf 'RAVEBERG event start complete.\n'
  printf 'Quick tunnel base URL: %s\n' "$TUNNEL_URL"
  printf 'Guest upload URL: %s\n' "$FINAL_UPLOAD_URL"
  printf 'cloudflared log: %s\n' "$LOG_FILE"
  printf 'cloudflared pid file: %s\n' "$PID_FILE"
}

main "$@"
