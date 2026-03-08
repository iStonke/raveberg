#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
ENV_FILE=${RAVEBERG_ENV_FILE:-"$ROOT_DIR/ops/pi/env.appliance"}

if [ -f "$ENV_FILE" ]; then
  exec docker compose --env-file "$ENV_FILE" down
fi

exec docker compose down
