#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname "$0")/../.." && pwd)
RENDERER_DIR="$ROOT_DIR/renderer_headless"
ENV_FILE=${RAVEBERG_RENDERER_ENV_FILE:-"$ROOT_DIR/ops/renderer_headless/env.renderer"}

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
else
  echo "[renderer_headless] env file not found at $ENV_FILE" >&2
  echo "[renderer_headless] copy ops/renderer_headless/env.renderer.example to env.renderer and adjust it" >&2
fi

cd "$RENDERER_DIR"
exec npm run start:prod
