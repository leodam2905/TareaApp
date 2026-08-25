import json, time, urllib.request, urllib.error, jwt
KEY_ID="54F786QLW9"; ISSUER="d4043b84-ff32-4cd9-bef8-a0d183c13991"
KEY=open("/Users/monsegueadah/.appstoreconnect/private_keys/AuthKey_54F786QLW9.p8").read()
BASE="https://api.appstoreconnect.apple.com"
VERSION="1.0.21"
WHATS_NEW = ("Hiring a pro now includes payment, so a job is confirmed the moment you hire.\n"
             "Pros can see the jobs they have applied to, and their earnings.\n"
             "The job timer can be paused and resumed, and the customer sees it.\n"
             "Licence and insurance are now shown as separate verified badges.\n"
             "Distances are shown in miles.")

def token():
    return jwt.encode({"iss":ISSUER,"iat":int(time.time()),"exp":int(time.time())+900,"aud":"appstoreconnect-v1"},
                      KEY, algorithm="ES256", headers={"kid":KEY_ID,"typ":"JWT"})

def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE+path, data=data, method=method,
        headers={"Authorization":f"Bearer {token()}", "Content-Type":"application/json"})
    try:
        raw = urllib.request.urlopen(req, timeout=45).read()
        return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        detail = e.read().decode()[:400]
        raise RuntimeError(f"{method} {path} -> {e.code}: {detail}")

for app_id, name in [("6784023441","Tarea Home"), ("6784029141","Tarea Pro")]:
    print(f"\n=== {name}")
    # Reuse an existing editable 1.0.21 if one is somehow there; otherwise create.
    existing = call("GET", f"/v1/apps/{app_id}/appStoreVersions?filter[versionString]={VERSION}&limit=1")["data"]
    if existing:
        ver = existing[0]; print(f"  version {VERSION} exists (state={ver['attributes'].get('appStoreState')})")
    else:
        ver = call("POST", "/v1/appStoreVersions", {"data":{"type":"appStoreVersions",
            "attributes":{"platform":"IOS","versionString":VERSION,"releaseType":"AFTER_APPROVAL"},
            "relationships":{"app":{"data":{"type":"apps","id":app_id}}}}})["data"]
        print(f"  created version {VERSION} -> {ver['id']}")
    vid = ver["id"]

    build = next(b for b in call("GET", f"/v1/builds?filter[app]={app_id}&limit=5&sort=-uploadedDate")["data"]
                 if b["attributes"].get("version")=="45")
    call("PATCH", f"/v1/appStoreVersions/{vid}/relationships/build",
         {"data":{"type":"builds","id":build["id"]}})
    print(f"  attached build 45 ({build['id']})")

    locs = call("GET", f"/v1/appStoreVersions/{vid}/appStoreVersionLocalizations?limit=20")["data"]
    for loc in locs:
        call("PATCH", f"/v1/appStoreVersionLocalizations/{loc['id']}",
             {"data":{"type":"appStoreVersionLocalizations","id":loc["id"],
                      "attributes":{"whatsNew":WHATS_NEW}}})
    print(f"  release notes set on {len(locs)} locale(s): {[l['attributes']['locale'] for l in locs]}")
