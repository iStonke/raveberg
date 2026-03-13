#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)

usage() {
  echo "Usage: $0 <PI-IP|hostname|full-display-url>" >&2
  echo "Example: $0 192.168.178.92" >&2
  echo "Example: $0 http://192.168.178.92:8085/display" >&2
  exit 1
}

TARGET=${1:-}
if [ -z "$TARGET" ]; then
  usage
fi

case "$TARGET" in
  http://*|https://*)
    DISPLAY_URL=$TARGET
    ;;
  *)
    DISPLAY_URL="http://$TARGET:8085/display"
    ;;
esac

exec sh "$ROOT_DIR/ops/mac/start-display-client.sh" "$DISPLAY_URL"
