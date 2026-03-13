#!/bin/sh
set -eu

if [ "$(id -u)" -ne 0 ]; then
  echo "Please run as root (for example: sudo bash ops/pi/setup/install-setup-deps.sh)" >&2
  exit 1
fi

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../../.." && pwd)

apt-get update
apt-get install -y network-manager dnsmasq iw

if apt-cache show nodogsplash >/dev/null 2>&1; then
  apt-get install -y nodogsplash
  echo "Installed NoDogSplash from apt."
else
  cat >&2 <<EOF
nodogsplash is not available via apt on this image.
Use the official project source instead:
  https://github.com/nodogsplash/nodogsplash
Recommended fallback:
  apt-get install -y build-essential git libmicrohttpd-dev
  git clone https://github.com/nodogsplash/nodogsplash.git /usr/local/src/nodogsplash
  cd /usr/local/src/nodogsplash
  make
  make install
EOF
fi

install -d /etc/default
if [ ! -f /etc/default/raveberg-setup-mode ]; then
  install -m 644 "$ROOT_DIR/ops/pi/setup/env.setup.example" /etc/default/raveberg-setup-mode
fi

install -m 644 "$ROOT_DIR/ops/systemd/raveberg-setup-mode.service" /etc/systemd/system/raveberg-setup-mode.service
systemctl daemon-reload

cat <<EOF
Setup dependencies installed.
Review /etc/default/raveberg-setup-mode and then enable the service control path:
  systemctl status raveberg-setup-mode.service
EOF
