#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
ENV_FILE=${RAVEBERG_ENV_FILE:-"$ROOT_DIR/ops/pi/env.appliance"}
EXAMPLE_FILE="$ROOT_DIR/ops/pi/env.appliance.example"
RUNTIME_DIR=${RAVEBERG_RUNTIME_DIR:-"$ROOT_DIR/ops/pi/runtime"}
LOG_FILE=${RAVEBERG_CLOUDFLARED_LOG:-"$RUNTIME_DIR/cloudflared.log"}
PID_FILE=${RAVEBERG_CLOUDFLARED_PID_FILE:-"$RUNTIME_DIR/cloudflared.pid"}
EVENT_INFO_FILE=${RAVEBERG_EVENT_INFO_FILE:-"$RUNTIME_DIR/event-info.txt"}
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

load_env_file() {
  if [ -f "$ENV_FILE" ]; then
    set -a
    . "$ENV_FILE"
    set +a
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

write_event_info() {
  STARTED_AT=$(date '+%Y-%m-%d %H:%M:%S %Z')
  cat > "$EVENT_INFO_FILE" <<EOF
RAVEBERG Event Info
Started at: $STARTED_AT
Public guest upload: $FINAL_UPLOAD_URL
Local display: $LOCAL_DISPLAY_URL
Local admin: $LOCAL_ADMIN_URL
Tunnel base URL: $TUNNEL_URL
Tunnel log: $LOG_FILE
Tunnel pid file: $PID_FILE
Stop command: bash ops/pi/stop-event.sh
Mac display start: bash ops/mac/start-event-display.sh $DISPLAY_HOST_HINT
EOF
}

main() {
  require_command docker
  require_command cloudflared
  require_command grep
  require_command awk

  mkdir -p "$RUNTIME_DIR"
  ensure_env_file
  load_env_file

  log "Starting appliance stack with $ENV_FILE"
  compose_up

  stop_existing_tunnel
  start_tunnel

  TUNNEL_URL=$(wait_for_tunnel_url)
  FINAL_UPLOAD_URL="${TUNNEL_URL%/}${GUEST_UPLOAD_PATH}"

  log "Setting guest upload URL to $FINAL_UPLOAD_URL"
  sh "$ROOT_DIR/ops/pi/set-guest-upload-url.sh" "$FINAL_UPLOAD_URL"
  load_env_file

  log "Restarting appliance stack so frontend/backend pick up the new runtime URL"
  compose_up

  PUBLIC_BASE_URL=${PUBLIC_BASE_URL:-http://127.0.0.1:8085}
  ADMIN_PATH=${ADMIN_PATH:-/admin/login}
  DISPLAY_PATH=${DISPLAY_PATH:-/display}
  LOCAL_DISPLAY_URL="${PUBLIC_BASE_URL%/}${DISPLAY_PATH}"
  LOCAL_ADMIN_URL="${PUBLIC_BASE_URL%/}${ADMIN_PATH}"
  DISPLAY_HOST_HINT=$(printf '%s\n' "$PUBLIC_BASE_URL" | sed -E 's#^https?://([^/:]+).*$#\1#')
  write_event_info

  printf '\n'
  printf 'RAVEBERG event start complete.\n'
  printf 'Public guest upload: %s\n' "$FINAL_UPLOAD_URL"
  printf 'Local display:       %s\n' "$LOCAL_DISPLAY_URL"
  printf 'Local admin:         %s\n' "$LOCAL_ADMIN_URL"
  printf 'Tunnel base URL:     %s\n' "$TUNNEL_URL"
  printf 'Tunnel log:          %s\n' "$LOG_FILE"
  printf 'Event info:          %s\n' "$EVENT_INFO_FILE"
  printf 'Stop command:        bash ops/pi/stop-event.sh\n'
  printf 'Mac display start:   bash ops/mac/start-event-display.sh %s\n' "$DISPLAY_HOST_HINT"
}

main "$@"
