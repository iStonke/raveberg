#!/bin/sh
set -eu

URL=${1:?URL missing}
ATTEMPTS=${2:-120}
SLEEP_SECONDS=${3:-2}

probe() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsS --max-time 5 "$URL" >/dev/null
    return $?
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -qO- "$URL" >/dev/null
    return $?
  fi

  echo "Neither curl nor wget is available." >&2
  return 1
}

attempt=1
while [ "$attempt" -le "$ATTEMPTS" ]; do
  if probe; then
    exit 0
  fi

  sleep "$SLEEP_SECONDS"
  attempt=$((attempt + 1))
done

echo "Timed out waiting for $URL" >&2
exit 1
