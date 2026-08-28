#!/usr/bin/env bash
# Host side of the screenshot handshake.
#
# The integration test drops a `shot-<name>` marker in its own tmp directory
# when it is sitting on a screen worth capturing, then blocks. This watches the
# app's data container for those markers, takes a real simulator screenshot, and
# writes `done-<name>` to release the app.
#
# Needed because integration_test's takeScreenshot returns a stale frame on iOS,
# and its driver callbacks do not run until the whole test has finished — which
# made every screenshot show the last screen.
set -uo pipefail
SIM="${1:?simulator udid}"
BUNDLE="${2:?bundle id}"
OUT="${3:-build/screenshots}"
DEADLINE=$((SECONDS + 600))

mkdir -p "$OUT"
echo "watching for markers (bundle $BUNDLE)"
while [ $SECONDS -lt $DEADLINE ]; do
  DATA="$(xcrun simctl get_app_container "$SIM" "$BUNDLE" data 2>/dev/null)"
  if [ -n "$DATA" ] && [ -d "$DATA/tmp" ]; then
    for marker in "$DATA"/tmp/shot-*; do
      [ -e "$marker" ] || continue
      NAME="$(basename "$marker")"; NAME="${NAME#shot-}"
      [ -e "$DATA/tmp/done-$NAME" ] && continue
      # Let the frame settle after the app stops animating.
      sleep 1
      if xcrun simctl io "$SIM" screenshot "$OUT/$NAME.png" >/dev/null 2>&1; then
        echo "  captured $NAME.png ($(( $(stat -f%z "$OUT/$NAME.png") / 1024 )) KB)"
      else
        echo "  FAILED $NAME"
      fi
      touch "$DATA/tmp/done-$NAME"
    done
  fi
  sleep 1
done
echo "watcher done"
