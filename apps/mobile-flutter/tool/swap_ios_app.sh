#!/usr/bin/env bash
# Swap the shared iOS Runner between the two apps before an App Store build.
#
# iOS ships from ONE Runner target; the per-app identity (bundle id, display
# name, Firebase config, app icon, splash) is swapped in right before
# archiving, then reverted with `git checkout` afterwards.
#
#   ./tool/swap_ios_app.sh home   # Tarea (customer)  -> com.taptarea.customer
#   ./tool/swap_ios_app.sh pro    # Tarea Pro         -> com.taptarea.handyman
#
# Run this, then `flutter build ios --release --no-codesign` + xcodebuild
# archive, then `git checkout` the touched files to restore the repo default.
set -euo pipefail

FLAVOR="${1:-}"
case "$FLAVOR" in
  home) BUNDLE="com.taptarea.customer"; DISPLAY="Tarea";     GCFG="customer"; ICON="assets/images/icon.png" ;;
  pro)  BUNDLE="com.taptarea.handyman"; DISPLAY="Tarea Pro"; GCFG="handyman"; ICON="assets/images/icon-pro.png" ;;
  *) echo "usage: $0 {home|pro}" >&2; exit 1 ;;
esac

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PBX="ios/Runner.xcodeproj/project.pbxproj"
PLIST="ios/Runner/Info.plist"
ICONSET="ios/Runner/Assets.xcassets/AppIcon.appiconset"

# 1) Bundle identifier (main app + RunnerTests), whatever it is now -> target.
sed -i '' -E "s/PRODUCT_BUNDLE_IDENTIFIER = com\.taptarea\.[a-z]+\.RunnerTests;/PRODUCT_BUNDLE_IDENTIFIER = ${BUNDLE}.RunnerTests;/g" "$PBX"
sed -i '' -E "s/PRODUCT_BUNDLE_IDENTIFIER = com\.taptarea\.[a-z]+;/PRODUCT_BUNDLE_IDENTIFIER = ${BUNDLE};/g" "$PBX"

# 2) Display name.
/usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName ${DISPLAY}" "$PLIST"

# 3) Firebase config for this app.
cp "ios/config/${GCFG}/GoogleService-Info.plist" "ios/Runner/GoogleService-Info.plist"

# 4) App icon — resize the flavor's 1024 master into every AppIcon slot.
python3 - "$ICON" "$ICONSET" <<'PY'
import json, subprocess, sys, os
icon, iconset = sys.argv[1], sys.argv[2]
imgs = json.load(open(os.path.join(iconset, "Contents.json")))["images"]
done = set()
for i in imgs:
    fn = i["filename"]
    if fn in done: continue
    done.add(fn)
    px = int(float(i["size"].split("x")[0]) * int(i["scale"].replace("x", "")))
    subprocess.run(["sips", "-s", "format", "png", "-z", str(px), str(px), icon,
                    "--out", os.path.join(iconset, fn)],
                   check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
print(f"  regenerated {len(done)} icon sizes from {icon}")
PY

# 5) Splash images for this app.
"$ROOT/tool/swap_ios_splash.sh" "$FLAVOR"

echo "iOS Runner swapped to '$FLAVOR' (${BUNDLE}, \"${DISPLAY}\")."
