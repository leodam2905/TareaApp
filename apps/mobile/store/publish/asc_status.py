#!/usr/bin/env python3
"""Where each iOS app stands in App Store Connect — builds and review state.

    python3 asc_status.py

Read-only. Answers the two questions the Dashboard makes you click through
for: has the latest build finished processing and reached TestFlight, and is
there an App Store version in review.
"""
import json, time, urllib.request, urllib.error
import jwt

KEY = "/Users/monsegueadah/TareaApp/apps/mobile/store/appstore/AuthKey_54F786QLW9.p8"
KID, ISS = "54F786QLW9", "d4043b84-ff32-4cd9-bef8-a0d183c13991"
APPS = {"Tarea (customer)": "6784023441", "Tarea Pro": "6784029141"}
BASE = "https://api.appstoreconnect.apple.com/v1"


def token():
    now = int(time.time())
    return jwt.encode({"iss": ISS, "iat": now, "exp": now + 900, "aud": "appstoreconnect-v1"},
                      open(KEY).read(), algorithm="ES256", headers={"kid": KID, "typ": "JWT"})


def get(path, tok):
    req = urllib.request.Request(f"{BASE}{path}")
    req.add_header("Authorization", f"Bearer {tok}")
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        return {"_error": f"HTTP {e.code}: {e.read().decode()[:200]}"}


tok = token()
for name, app_id in APPS.items():
    print(f"\n\033[1m{name}\033[0m  (app {app_id})")

    builds = get(f"/builds?filter[app]={app_id}&limit=3&sort=-uploadedDate", tok)
    if "_error" in builds:
        print(f"  {builds['_error']}")
        continue
    for b in builds.get("data", []):
        a = b["attributes"]
        line = f"  build {a.get('version'):<5} {a.get('processingState','?'):<12} uploaded {(a.get('uploadedDate') or '')[:16]}"
        detail = get(f"/builds/{b['id']}/buildBetaDetail", tok)
        state = detail.get("data", {}).get("attributes", {}).get("internalBuildState", "?")
        # The honest signal for "can an internal tester install it" — the
        # betaGroups relationship lies for internal groups.
        print(f"{line}  testflight={state}")
        if a.get("expired"):
            print("        (expired)")

    vers = get(f"/appStoreVersions?filter[app]={app_id}&limit=3&sort=-createdDate", tok)
    print("  App Store versions:")
    for v in vers.get("data", [])[:3]:
        a = v["attributes"]
        print(f"    {a.get('versionString'):<8} {a.get('appStoreState','?'):<28} {a.get('releaseType','')}")
