#!/bin/sh
set -eu

ROOT_DIR=${ROOT_DIR:-/opt/raveberg}
ENV_FILE=${RAVEBERG_SETUP_ENV_FILE:-/etc/default/raveberg-setup-mode}

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  . "$ENV_FILE"
fi

WIFI_INTERFACE=${WIFI_INTERFACE:-wlan0}
SETUP_MODE_SSID=${SETUP_MODE_SSID:-RaveBerg-Setup}
SETUP_MODE_ADDRESS=${SETUP_MODE_ADDRESS:-192.168.4.1}
SETUP_MODE_PREFIX_LENGTH=${SETUP_MODE_PREFIX_LENGTH:-24}
SETUP_MODE_DHCP_START=${SETUP_MODE_DHCP_START:-192.168.4.10}
SETUP_MODE_DHCP_END=${SETUP_MODE_DHCP_END:-192.168.4.50}
SETUP_MODE_CONNECTION_NAME=${SETUP_MODE_CONNECTION_NAME:-raveberg-setup-ap}
SETUP_MODE_RUNTIME_DIR=${SETUP_MODE_RUNTIME_DIR:-$ROOT_DIR/ops/pi/runtime/setup-mode}
SETUP_MODE_PORTAL_PATH=${SETUP_MODE_PORTAL_PATH:-/setup}
EVENT_NAME=${EVENT_NAME:-RAVEBERG}
DNSMASQ_BIN=${DNSMASQ_BIN:-dnsmasq}
NODOGSPLASH_BIN=${NODOGSPLASH_BIN:-nodogsplash}

SETUP_MODE_PORTAL_URL=${SETUP_MODE_PORTAL_URL:-http://$SETUP_MODE_ADDRESS$SETUP_MODE_PORTAL_PATH}
DNSMASQ_CONF="$SETUP_MODE_RUNTIME_DIR/dnsmasq.conf"
DNSMASQ_PID="$SETUP_MODE_RUNTIME_DIR/dnsmasq.pid"
DNSMASQ_LEASES="$SETUP_MODE_RUNTIME_DIR/dnsmasq.leases"
NDS_CONF="$SETUP_MODE_RUNTIME_DIR/nodogsplash.conf"
NDS_PID="$SETUP_MODE_RUNTIME_DIR/nodogsplash.pid"
NDS_LOG="$SETUP_MODE_RUNTIME_DIR/nodogsplash.log"
PORTAL_DIR="$SETUP_MODE_RUNTIME_DIR/htdocs"
PORTAL_TEMPLATE="$ROOT_DIR/ops/pi/setup/nodogsplash/splash.html.template"
PORTAL_HTML="$PORTAL_DIR/splash.html"

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

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

need_command nmcli
need_command "$DNSMASQ_BIN"
need_command "$NODOGSPLASH_BIN"

mkdir -p "$SETUP_MODE_RUNTIME_DIR" "$PORTAL_DIR"

if [ -f "$PORTAL_TEMPLATE" ]; then
  sed \
    -e "s|__EVENT_NAME__|$EVENT_NAME|g" \
    -e "s|__PORTAL_URL__|$SETUP_MODE_PORTAL_URL|g" \
    -e "s|__FALLBACK_URL__|http://$SETUP_MODE_ADDRESS|g" \
    < "$PORTAL_TEMPLATE" \
    > "$PORTAL_HTML"
fi

cat > "$DNSMASQ_CONF" <<EOF
port=0
interface=$WIFI_INTERFACE
bind-interfaces
listen-address=$SETUP_MODE_ADDRESS
dhcp-range=$SETUP_MODE_DHCP_START,$SETUP_MODE_DHCP_END,255.255.255.0,8h
dhcp-option=3,$SETUP_MODE_ADDRESS
dhcp-option=6,$SETUP_MODE_ADDRESS
address=/#/$SETUP_MODE_ADDRESS
no-resolv
domain-needed
bogus-priv
dhcp-leasefile=$DNSMASQ_LEASES
EOF

if [ -f /etc/nodogsplash/nodogsplash.conf ]; then
  cp /etc/nodogsplash/nodogsplash.conf "$NDS_CONF"
else
  : > "$NDS_CONF"
fi

cat >> "$NDS_CONF" <<EOF

GatewayInterface $WIFI_INTERFACE
GatewayAddress $SETUP_MODE_ADDRESS
GatewayName $EVENT_NAME Setup
WebRoot $PORTAL_DIR
SplashPage splash.html
MaxClients 32
EOF

kill_pidfile "$DNSMASQ_PID"
kill_pidfile "$NDS_PID"

nmcli radio wifi on >/dev/null 2>&1 || true
nmcli connection delete "$SETUP_MODE_CONNECTION_NAME" >/dev/null 2>&1 || true
nmcli connection add type wifi ifname "$WIFI_INTERFACE" con-name "$SETUP_MODE_CONNECTION_NAME" ssid "$SETUP_MODE_SSID" >/dev/null
nmcli connection modify "$SETUP_MODE_CONNECTION_NAME" \
  802-11-wireless.mode ap \
  802-11-wireless.band bg \
  ipv4.method manual \
  ipv4.addresses "$SETUP_MODE_ADDRESS/$SETUP_MODE_PREFIX_LENGTH" \
  ipv4.never-default yes \
  ipv6.method disabled \
  connection.autoconnect no \
  connection.interface-name "$WIFI_INTERFACE" >/dev/null
nmcli connection up "$SETUP_MODE_CONNECTION_NAME" >/dev/null

"$DNSMASQ_BIN" --conf-file="$DNSMASQ_CONF" --pid-file="$DNSMASQ_PID"

nohup "$NODOGSPLASH_BIN" -f -c "$NDS_CONF" >"$NDS_LOG" 2>&1 &
echo $! > "$NDS_PID"
sleep 1

if ! kill -0 "$(cat "$NDS_PID")" 2>/dev/null; then
  echo "nodogsplash failed to start, see $NDS_LOG" >&2
  exit 1
fi
