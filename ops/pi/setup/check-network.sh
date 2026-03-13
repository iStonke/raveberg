#!/bin/sh
set -eu

WIFI_INTERFACE=${WIFI_INTERFACE:-wlan0}
SETUP_MODE_SERVICE_NAME=${SETUP_MODE_SERVICE_NAME:-raveberg-setup-mode.service}

echo "== Wi-Fi status =="
nmcli -t -f GENERAL.STATE,GENERAL.CONNECTION,IP4.ADDRESS device show "$WIFI_INTERFACE" || true
echo
echo "== Visible networks =="
nmcli -t -f ACTIVE,SSID,SIGNAL,SECURITY device wifi list ifname "$WIFI_INTERFACE" --rescan no || true
echo
echo "== Setup mode service =="
systemctl is-active "$SETUP_MODE_SERVICE_NAME" || true
