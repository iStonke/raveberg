#!/bin/sh
set -eu

ROOT_DIR=${ROOT_DIR:-/opt/raveberg}
ENV_FILE=${RAVEBERG_SETUP_ENV_FILE:-/etc/default/raveberg-setup-mode}

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE"
fi

WIFI_INTERFACE=${WIFI_INTERFACE:-wlan0}
SETUP_MODE_CONNECTION_NAME=${SETUP_MODE_CONNECTION_NAME:-raveberg-setup-ap}
SETUP_MODE_RUNTIME_DIR=${SETUP_MODE_RUNTIME_DIR:-$ROOT_DIR/ops/pi/runtime/setup-mode}

kill_pidfile() {
  pid_file=$1
  if [ -f "$pid_file" ]; then
    pid=$(cat "$pid_file" 2>/dev/null || true)
    if [ -n "${pid:-}" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
      sleep 1
    fi
    rm -f "$pid_file"
  fi
}

kill_pidfile "$SETUP_MODE_RUNTIME_DIR/nodogsplash.pid"
kill_pidfile "$SETUP_MODE_RUNTIME_DIR/dnsmasq.pid"

if command -v nmcli >/dev/null 2>&1; then
  nmcli connection down "$SETUP_MODE_CONNECTION_NAME" >/dev/null 2>&1 || true
  nmcli connection delete "$SETUP_MODE_CONNECTION_NAME" >/dev/null 2>&1 || true
  nmcli device reapply "$WIFI_INTERFACE" >/dev/null 2>&1 || true
fi
