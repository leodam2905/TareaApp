import json, time, urllib.request, urllib.error, jwt
KEY_ID="54F786QLW9"; ISSUER="d4043b84-ff32-4cd9-bef8-a0d183c13991"
KEY=open("/Users/monsegueadah/.appstoreconnect/private_keys/AuthKey_54F786QLW9.p8").read()
BASE="https://api.appstoreconnect.apple.com"
def token():
    return jwt.encode({"iss":ISSUER,"iat":int(time.time()),"exp":int(time.time())+900,"aud":"appstoreconnect-v1"},
                      KEY, algorithm="ES256", headers={"kid":KEY_ID,"typ":"JWT"})
def call(method, path, body=None):
    data=json.dumps(body).encode() if body is not None else None
    req=urllib.request.Request(BASE+path, data=data, method=method,
        headers={"Authorization":f"Bearer {token()}","Content-Type":"application/json"})
    try:
        raw=urllib.request.urlopen(req,timeout=45).read()
        return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"{method} {path} -> {e.code}: {e.read().decode()[:500]}")

VERSIONS=[("6784023441","Tarea Home","2c717238-ad81-496a-b441-d373f8561d81"),
          ("6784029141","Tarea Pro","6a59ca37-9abf-4064-bd3e-40e3a9bfcccf")]
for app_id, name, vid in VERSIONS:
    print(f"\n=== {name}")
    # Reuse an unsubmitted review submission if one is open, else create one.
    subs=call("GET", f"/v1/reviewSubmissions?filter[app]={app_id}&filter[state]=READY_FOR_REVIEW&limit=1")["data"]
    if subs:
        sub=subs[0]; print(f"  reusing review submission {sub['id']}")
    else:
        sub=call("POST","/v1/reviewSubmissions",{"data":{"type":"reviewSubmissions",
            "attributes":{"platform":"IOS"},
            "relationships":{"app":{"data":{"type":"apps","id":app_id}}}}})["data"]
        print(f"  created review submission {sub['id']}")
    call("POST","/v1/reviewSubmissionItems",{"data":{"type":"reviewSubmissionItems",
        "relationships":{"reviewSubmission":{"data":{"type":"reviewSubmissions","id":sub["id"]}},
                         "appStoreVersion":{"data":{"type":"appStoreVersions","id":vid}}}}})
    print("  attached version to submission")
    out=call("PATCH", f"/v1/reviewSubmissions/{sub['id']}",
             {"data":{"type":"reviewSubmissions","id":sub["id"],"attributes":{"submitted":True}}})
    print(f"  SUBMITTED -> state={out['data']['attributes'].get('state')}")
