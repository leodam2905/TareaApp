#!/usr/bin/env bash
# Swap the iOS launch screen image for a flavor before building that iOS app.
#
# iOS builds from one shared Runner target (bundle id / icon / GoogleService are
# already swapped per app at build time); the splash follows the same pattern.
# Both flavors' launch images are the same dimensions, so only the PNG bytes
# change — no storyboard edit needed.
#
#   ./tool/swap_ios_splash.sh home   # Tarea (customer)  — this is the committed default
#   ./tool/swap_ios_splash.sh pro    # Tarea Pro (handyman)
#
# Run the matching swap right before `flutter build ipa`/xcodebuild for each app.
set -euo pipefail

FLAVOR="${1:-}"
if [[ "$FLAVOR" != "home" && "$FLAVOR" != "pro" ]]; then
  echo "usage: $0 {home|pro}" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/ios/launch-images/$FLAVOR"
ASSETS="$ROOT/ios/Runner/Assets.xcassets"

if [[ ! -d "$SRC" ]]; then
  echo "error: launch images for '$FLAVOR' not found at $SRC" >&2
  exit 1
fi

# Home is white logo on dark charcoal, Pro is dark logo on white — so both the
# centered logo (LaunchImage) and the full-screen background (LaunchBackground)
# differ and must be swapped.
cp "$SRC"/LaunchImage*.png       "$ASSETS/LaunchImage.imageset/"
cp "$SRC"/background.png "$SRC"/darkbackground.png "$ASSETS/LaunchBackground.imageset/"
echo "iOS launch screen set to '$FLAVOR'."
