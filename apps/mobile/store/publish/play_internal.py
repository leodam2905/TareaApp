#!/usr/bin/env python3
"""Upload an .aab to a Play track (default: internal).

    python3 play_internal.py <package> <aab> [--track internal] [--notes "..."]

Uses the eas-play-submit service account and nothing but the stdlib plus pyjwt,
deliberately: this has to keep working on a machine where pip installs are not
guaranteed, and it is the only path to Play that does not involve the console.

Flow (Android Publisher v3): token -> insert edit -> upload bundle bytes as
octet-stream -> assign the versionCode to the track -> commit. Nothing is
visible to testers until the commit, so a failure part-way leaves no half-made
release behind.
"""
import json, sys, time, urllib.request, urllib.error
import jwt

SA = "/Users/monsegueadah/TareaApp/apps/mobile/google-service-account.json"
BASE = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"


def token():
    sa = json.load(open(SA))
    now = int(time.time())
    assertion = jwt.encode(
        {"iss": sa["client_email"], "scope": "https://www.googleapis.com/auth/androidpublisher",
         "aud": "https://oauth2.googleapis.com/token", "iat": now, "exp": now + 3600},
        sa["private_key"], algorithm="RS256")
    body = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer", "assertion": assertion}).encode()
    with urllib.request.urlopen(urllib.request.Request(
            "https://oauth2.googleapis.com/token", data=body,
            headers={"Content-Type": "application/x-www-form-urlencoded"})) as r:
        return json.load(r)["access_token"]


def call(method, url, tok, data=None, ctype="application/json"):
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {tok}")
    if data is not None:
        req.add_header("Content-Type", ctype)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        # The API's error body is the only place the real reason appears.
        print(f"HTTP {e.code} on {method} {url}\n{e.read().decode()[:900]}", file=sys.stderr)
        raise


def main():
    pkg, aab = sys.argv[1], sys.argv[2]
    track = sys.argv[sys.argv.index("--track") + 1] if "--track" in sys.argv else "internal"
    notes = sys.argv[sys.argv.index("--notes") + 1] if "--notes" in sys.argv else None

    tok = token()
    edit = call("POST", f"{BASE}/{pkg}/edits", tok, b"")["id"]
    print(f"edit {edit}")

    with open(aab, "rb") as f:
        blob = f.read()
    up = call("POST",
              f"https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/{pkg}/edits/{edit}/bundles?uploadType=media",
              tok, blob, "application/octet-stream")
    vc = up["versionCode"]
    print(f"uploaded versionCode {vc}")

    release = {"versionCodes": [str(vc)], "status": "completed"}
    if notes:
        release["releaseNotes"] = [{"language": "en-US", "text": notes}]
    call("PUT", f"{BASE}/{pkg}/edits/{edit}/tracks/{track}", tok,
         json.dumps({"track": track, "releases": [release]}).encode())
    print(f"assigned to {track}")

    call("POST", f"{BASE}/{pkg}/edits/{edit}:commit", tok, b"")
    print(f"committed — {pkg} versionCode {vc} is live on {track}")


if __name__ == "__main__":
    main()
